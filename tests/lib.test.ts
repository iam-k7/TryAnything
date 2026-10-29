import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRateLimiter, clientIp } from "@/lib/server/rate-limit";
import { isAllowedOrigin, resolveAllowedOrigin } from "@/lib/server/origin";
import { redact } from "@/lib/server/logger";
import { getServerEnv } from "@/lib/server/env";
import { LEGAL_DOCS } from "@/lib/legal";
import { CATEGORIES, PRODUCTS, customItemPrompt, findProduct } from "@/lib/catalog";
import { sniffImageType } from "@/lib/upload";
import { apiErrorMessage, requestPhotoTryOn } from "@/lib/api-client";

describe("rate limiter", () => {
  it("allows up to the limit then blocks until the window resets", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("a", 0).ok).toBe(true);
    expect(check("a", 10).ok).toBe(true);
    const blocked = check("a", 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(check("b", 20).ok).toBe(true); // per key
    expect(check("a", 1001).ok).toBe(true); // new window
  });
  it("keeps memory bounded", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 3 });
    for (let i = 0; i < 50; i++) check(`k${i}`, 0);
    expect(check("k49", 0).ok).toBe(false); // newest bucket survived
  });
  it("uses the proxy-added (right-most) forwarded IP, ignoring client-prepended entries", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("origin gate", () => {
  const allowed = ["https://tryanything.app"];
  it("accepts a matching Origin or Referer", () => {
    expect(isAllowedOrigin(new Headers({ origin: "https://tryanything.app" }), allowed)).toBe(true);
    expect(isAllowedOrigin(new Headers({ referer: "https://tryanything.app/x?y" }), allowed)).toBe(true);
  });
  it("in development only, accepts the request's own host (laptop, LAN phone, tunnel)", () => {
    const h = new Headers({ origin: "https://172.20.10.3:3000", host: "172.20.10.3:3000" });
    expect(resolveAllowedOrigin(h, allowed, true)).toBe("https://172.20.10.3:3000");
    expect(resolveAllowedOrigin(h, allowed, false)).toBeNull();
    expect(resolveAllowedOrigin(new Headers({ origin: "https://evil.com", host: "172.20.10.3:3000" }), allowed, true)).toBeNull();
  });
  it("rejects missing, foreign, or look-alike origins", () => {
    expect(isAllowedOrigin(new Headers(), allowed)).toBe(false);
    expect(isAllowedOrigin(new Headers({ origin: "https://evil.com" }), allowed)).toBe(false);
    expect(isAllowedOrigin(new Headers({ origin: "https://tryanything.app.evil.com" }), allowed)).toBe(false);
    expect(isAllowedOrigin(new Headers({ referer: "not a url" }), allowed)).toBe(false);
  });
});

describe("logger redaction", () => {
  it("redacts secret keys at any depth and Decart keys inside text", () => {
    expect(redact({ apiKey: "dct_x", nested: { token: "t", ok: 1 }, list: [{ password: "p" }] })).toEqual({
      apiKey: "[REDACTED]",
      nested: { token: "[REDACTED]", ok: 1 },
      list: [{ password: "[REDACTED]" }],
    });
    expect(redact("bad key dct_abc123")).toBe("bad key dct_[REDACTED]");
  });
});

describe("server env", () => {
  const env = (o: Record<string, string>) => getServerEnv(o as unknown as NodeJS.ProcessEnv);
  it("applies safe defaults", () => {
    expect(env({})).toMatchObject({ model: "lucy-vton-latest", imageModel: "lucy-image-2", tokenTtlSeconds: 60, maxSessionSeconds: 180, scopeTokenToModel: false });
    expect(env({}).decartApiKey).toBeUndefined();
  });
  it("parses origins and rejects invalid caps and unknown models", () => {
    expect(env({ APP_ORIGINS: "https://a.com/, https://b.com" }).appOrigins).toEqual(["https://a.com", "https://b.com"]);
    expect(() => env({ DECART_MAX_SESSION_SECONDS: "5" })).toThrow();
    expect(() => env({ DECART_MODEL: "lucy-image-2" })).toThrow(); // image model is not realtime
    expect(() => env({ DECART_IMAGE_MODEL: "made-up" })).toThrow();
  });
});

describe("catalog", () => {
  it("has unique ids, a product in every category, and images on disk", () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const c of CATEGORIES) expect(PRODUCTS.some((p) => p.category === c.id), c.id).toBe(true);
    for (const p of PRODUCTS) expect(existsSync(path.join(__dirname, "../public", p.image)), p.image).toBe(true);
  });
  it("offers live mode only for photographed garments, never accessories", () => {
    for (const p of PRODUCTS.filter((p) => p.live)) {
      expect(p.reference).toBe(true);
      expect("small" in CATEGORIES.find((c) => c.id === p.category)!).toBe(false);
    }
  });
  it("builds fixed prompts for uploaded items", () => {
    expect(customItemPrompt("tops")).toMatch(/^Substitute the person's current top/);
    expect(customItemPrompt("glasses")).toMatch(/^Add the eyewear/);
    expect(findProduct("nope")).toBeUndefined();
  });
});

describe("upload sniffing", () => {
  const b = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)]);
  it("detects real formats from magic bytes", () => {
    expect(sniffImageType(b(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageType(b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });
  it("rejects anything else, including SVG and HTML", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("photo try-on client", () => {
  const product = PRODUCTS[0]!;
  it("sends only the product id (never a prompt) and returns the image", async () => {
    let sent: FormData | undefined;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = init.body as FormData;
      return new Response(new Blob(["x"], { type: "image/jpeg" }));
    }) as typeof fetch;
    const out = await requestPhotoTryOn(new Blob(["p"]), { product }, new AbortController().signal);
    expect(out.type).toBe("image/jpeg");
    expect(sent?.get("productId")).toBe(product.id);
    expect(sent?.has("prompt")).toBe(false);
  });
  it("surfaces the server's message and propagates aborts", async () => {
    globalThis.fetch = (async () => Response.json({ error: { code: "rate_limited", message: "Too many attempts." } }, { status: 429 })) as typeof fetch;
    await expect(requestPhotoTryOn(new Blob(["p"]), { product }, new AbortController().signal)).rejects.toThrow("Too many attempts.");

    globalThis.fetch = ((_: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const ctrl = new AbortController();
    const p = requestPhotoTryOn(new Blob(["p"]), { product }, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toThrow("aborted");
  });
  it("falls back to a generic message for non-JSON errors", async () => {
    expect(await apiErrorMessage(new Response("oops", { status: 500 }))).toBe("Request failed (500).");
  });
});

describe("legal docs", () => {
  it("serves exactly the three linked docs, and no longer mentions analytics or surveys as collected", () => {
    expect(Object.keys(LEGAL_DOCS).sort()).toEqual(["aup", "privacy", "terms"]);
    for (const d of Object.values(LEGAL_DOCS)) expect(d.sections.length).toBeGreaterThan(3);
    const privacy = JSON.stringify(LEGAL_DOCS.privacy);
    expect(privacy).not.toMatch(/Usage events|survey|age range/i);
  });
});
