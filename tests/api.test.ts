import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const process_ = vi.fn();
vi.mock("@decartai/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@decartai/sdk")>()),
  createDecartClient: () => ({ tokens: { create }, process: process_ }),
}));

const ORIGIN = "https://tryanything.app";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(1)]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(60).fill(2)]);

async function load<T>(route: "tokens" | "tryon", env: Record<string, string | undefined>): Promise<T> {
  vi.resetModules();
  for (const k of ["DECART_API_KEY", "APP_ORIGINS"]) delete process.env[k];
  Object.assign(process.env, env);
  return (route === "tokens" ? await import("@/app/api/v1/tokens/route") : await import("@/app/api/v1/tryon/route")) as T;
}
type Route = { POST: (r: Request) => Promise<Response> };
const ENV = { DECART_API_KEY: "dct_secret", APP_ORIGINS: ORIGIN };

beforeEach(() => {
  create.mockReset();
  process_.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const logged = () =>
  [console.log, console.warn, console.error].flatMap((f) => (f as unknown as { mock: { calls: unknown[][] } }).mock.calls).join(" ");

describe("POST /api/v1/tokens", () => {
  const req = (headers: Record<string, string> = { origin: ORIGIN, "x-forwarded-for": "9.9.9.9" }) =>
    new Request("http://localhost/api/v1/tokens", { method: "POST", headers });

  it("mints a scoped, session-capped token", async () => {
    create.mockResolvedValue({ apiKey: "ek_123", expiresAt: "2026-10-29T10:01:00Z" });
    const { POST } = await load<Route>("tokens", ENV);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ apiKey: "ek_123", expiresAt: "2026-10-29T10:01:00Z", model: "lucy-vton-latest", maxSessionSeconds: 180 });
    expect(create).toHaveBeenCalledWith({ expiresIn: 60, allowedOrigins: [ORIGIN], constraints: { realtime: { maxSessionDuration: 180 } } });
  });

  it("never leaks the permanent key or the minted token in logs", async () => {
    create.mockResolvedValue({ apiKey: "ek_123" });
    const { POST } = await load<Route>("tokens", ENV);
    await POST(req());
    expect(logged()).not.toContain("dct_secret");
    expect(logged()).not.toContain("ek_123");
  });

  it("rejects foreign origins", async () => {
    const { POST } = await load<Route>("tokens", ENV);
    expect((await POST(req({ origin: "https://evil.com" }))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("rate limits per IP, and globally across rotating IPs", async () => {
    create.mockResolvedValue({ apiKey: "ek" });
    const { POST } = await load<Route>("tokens", ENV);
    const perIp = [];
    for (let i = 0; i < 6; i++) perIp.push((await POST(req())).status);
    expect(perIp).toEqual([200, 200, 200, 200, 200, 429]);

    const { POST: fresh } = await load<Route>("tokens", ENV);
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await fresh(req({ origin: ORIGIN, "x-forwarded-for": `10.0.0.${i}` }))).status;
    expect(last).toBe(429);
    expect(create).toHaveBeenCalledTimes(5 + 30);
  });

  it("503 when not configured, 502 with a safe message when Decart fails", async () => {
    let { POST } = await load<Route>("tokens", { APP_ORIGINS: ORIGIN });
    expect((await POST(req())).status).toBe(503);

    create.mockRejectedValue(new Error("internal: dct_secret invalid"));
    ({ POST } = await load<Route>("tokens", ENV));
    const res = await POST(req());
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("dct_secret");
  });
});

describe("POST /api/v1/tryon", () => {
  let ip = 0;
  async function req(fields: Record<string, string | Uint8Array>, headers: Record<string, string> = {}) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, typeof v === "string" ? v : new Blob([v as BlobPart]));
    const encoded = new Response(form);
    const body = await encoded.arrayBuffer();
    return new Request("http://localhost/api/v1/tryon", {
      method: "POST",
      body,
      headers: {
        origin: ORIGIN,
        "x-forwarded-for": `20.0.0.${ip++ % 250}`,
        "content-type": encoded.headers.get("content-type")!,
        "content-length": String(body.byteLength),
        ...headers,
      },
    });
  }

  it("edits the photo with the catalog prompt and returns a re-typed image", async () => {
    process_.mockResolvedValue(new Blob([PNG], { type: "" }));
    const { POST } = await load<Route>("tryon", ENV);
    const res = await POST(await req({ photo: JPEG, productId: "hoodie", item: JPEG }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const call = process_.mock.calls[0]![0];
    expect(call.prompt).toMatch(/^Substitute the current top with a navy blue hoodie.*Keep the person's face/);
    expect(call.data.type).toBe("image/jpeg");
    expect(call.reference_image).toBeInstanceOf(Blob);
  });

  it("does not send a reference for illustrated samples, and requires one for uploaded items", async () => {
    process_.mockResolvedValue(new Blob([JPEG]));
    const { POST } = await load<Route>("tryon", ENV);
    expect((await POST(await req({ photo: JPEG, productId: "cap", item: JPEG }))).status).toBe(200);
    expect(process_.mock.calls[0]![0].reference_image).toBeUndefined();

    expect((await POST(await req({ photo: JPEG, category: "glasses" }))).status).toBe(400);
    expect((await POST(await req({ photo: JPEG, category: "glasses", item: PNG }))).status).toBe(200);
    expect(process_.mock.calls[1]![0].prompt).toMatch(/^Add the eyewear shown in the reference image/);
  });

  it("never logs images or the API key", async () => {
    process_.mockRejectedValue(new Error("Processing failed: 500 - dct_secret broke"));
    const { POST } = await load<Route>("tryon", ENV);
    const res = await POST(await req({ photo: JPEG, productId: "hoodie" }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("dct_secret");
    expect(logged()).not.toContain("dct_secret");
    expect(logged()).not.toContain("20.0.0."); // no IPs in our logs
  });

  it("rejects bad input before calling the provider", async () => {
    const { POST } = await load<Route>("tryon", ENV);
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
    expect((await POST(await req({ productId: "hoodie" }))).status).toBe(400); // no photo
    expect((await POST(await req({ photo: JPEG, productId: "nope" }))).status).toBe(400);
    expect((await POST(await req({ photo: JPEG, category: "spaceships", item: JPEG }))).status).toBe(400);
    expect((await POST(await req({ photo: JPEG, prompt: "anything I like" }))).status).toBe(400); // no free text path
    expect((await POST(await req({ photo: svg, productId: "hoodie" }))).status).toBe(415);
    expect((await POST(await req({ photo: new Uint8Array(2 * 1024 * 1024 + 10).fill(0xff), productId: "hoodie" }))).status).toBe(413);
    expect((await POST(await req({ photo: JPEG, productId: "hoodie" }, { "content-length": String(10 * 1024 * 1024) }))).status).toBe(413);
    expect((await POST(await req({ photo: JPEG, productId: "hoodie" }, { origin: "https://evil.com" }))).status).toBe(403);
    expect(process_).not.toHaveBeenCalled();
  });

  it("caps concurrent provider calls", async () => {
    const releases: (() => void)[] = [];
    process_.mockImplementation(() => new Promise((r) => releases.push(() => r(new Blob([JPEG])))));
    const { POST } = await load<Route>("tryon", ENV);
    const pending = await Promise.all([0, 1, 2, 3].map(() => req({ photo: JPEG, productId: "hoodie" })));
    const running = pending.map((r) => POST(r));
    await vi.waitFor(() => expect(process_).toHaveBeenCalledTimes(4));
    expect((await POST(await req({ photo: JPEG, productId: "hoodie" }))).status).toBe(503);
    releases.forEach((r) => r());
    expect((await Promise.all(running)).map((r) => r.status)).toEqual([200, 200, 200, 200]);
  });

  it("returns 504 on provider timeout", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new DOMException("timed out", "TimeoutError")));
    process_.mockImplementation(({ signal }: { signal: AbortSignal }) => Promise.reject(signal.reason));
    const { POST } = await load<Route>("tryon", ENV);
    expect((await POST(await req({ photo: JPEG, productId: "hoodie" }))).status).toBe(504);
  });

  it("rejects provider responses that are not images", async () => {
    process_.mockResolvedValue(new Blob(["<html>error</html>"], { type: "text/html" }));
    const { POST } = await load<Route>("tryon", ENV);
    expect((await POST(await req({ photo: JPEG, productId: "hoodie" }))).status).toBe(502);
  });
});
