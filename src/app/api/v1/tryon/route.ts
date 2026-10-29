import { z } from "zod";
import { getServerEnv } from "@/lib/server/env";
import { logger, errorMessage } from "@/lib/server/logger";
import { createBillableGuard } from "@/lib/server/guard";
import { apiError } from "@/lib/server/http";
import { decartPhotoTryOn } from "@/lib/server/photo-tryon";
import { UpstreamError } from "@/lib/server/decart-token";
import { CATEGORY_IDS, KEEP_PERSON, customItemPrompt, findProduct } from "@/lib/catalog";
import { MAX_BODY_BYTES, MAX_IMAGE_BYTES, sniffImageType } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const guard = createBillableGuard("tryon", { perIpPerMinute: 6, globalPerMinute: 30 });
const TIMEOUT_MS = 60_000;
const MAX_IN_FLIGHT = 4; // per server instance
let inFlight = 0;

// Either a catalog product, or an uploaded item image with its category. No free text is accepted.
const fields = z.union([
  z.object({ productId: z.string().max(64) }),
  z.object({ category: z.enum(CATEGORY_IDS) }),
]);

async function readImage(v: FormDataEntryValue | null): Promise<Blob | "missing" | "too_large" | "bad_type"> {
  if (!(v instanceof Blob)) return "missing";
  if (v.size > MAX_IMAGE_BYTES) return "too_large";
  const type = sniffImageType(new Uint8Array(await v.slice(0, 16).arrayBuffer()));
  return type ? new Blob([v], { type }) : "bad_type";
}

/**
 * Photo try-on. Images live only in this request's memory and go to the AI provider; nothing is
 * written to disk, a database or logs. Logs carry outcome and timing only.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const env = getServerEnv();
  const gate = guard(req, env);
  if (gate instanceof Response) return gate;

  const length = Number(req.headers.get("content-length"));
  if (!length) return apiError(411, "invalid_body", "Content-Length is required.");
  if (length > MAX_BODY_BYTES) return apiError(413, "payload_too_large", "Images are too large.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "invalid_body", "Expected a multipart form.");
  }
  const parsed = fields.safeParse({
    ...(form.has("productId") ? { productId: form.get("productId") } : { category: form.get("category") }),
  });
  if (!parsed.success) return apiError(400, "invalid_body", "Choose an item to try on.");

  const photo = await readImage(form.get("photo"));
  const item = form.has("item") ? await readImage(form.get("item")) : undefined;
  for (const img of [photo, item]) {
    if (img === "too_large") return apiError(413, "payload_too_large", "Images must be under 2 MB after resizing.");
    if (img === "bad_type") return apiError(415, "unsupported_media_type", "Use a JPEG, PNG or WebP image.");
  }
  if (!(photo instanceof Blob)) return apiError(400, "invalid_body", "Add a photo of yourself.");

  let prompt: string;
  let reference: Blob | undefined;
  if ("productId" in parsed.data) {
    const product = findProduct(parsed.data.productId);
    if (!product) return apiError(400, "invalid_body", "Unknown item.");
    prompt = product.prompt;
    // Sample photos come from the browser too (the server never fetches URLs); only real product photos are used.
    if (product.reference) reference = item instanceof Blob ? item : undefined;
  } else {
    if (!(item instanceof Blob)) return apiError(400, "invalid_body", "Add a photo of the item.");
    prompt = customItemPrompt(parsed.data.category);
    reference = item;
  }

  if (inFlight >= MAX_IN_FLIGHT) return apiError(503, "busy", "We're busy right now. Please try again in a minute.", { "Retry-After": "10" });
  inFlight++;
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  try {
    const result = await decartPhotoTryOn(env, { photo, prompt: prompt + KEEP_PERSON, reference, signal });
    logger.info("tryon.done", { ms: Date.now() - started, custom: !("productId" in parsed.data) });
    return new Response(result, { headers: { "Content-Type": result.type, "Cache-Control": "no-store" } });
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    const timedOut = signal.aborted;
    const status = err instanceof UpstreamError ? err.status : null;
    logger.error("tryon.failed", { timed_out: timedOut, upstream_status: status, error: errorMessage(err), ms: Date.now() - started });
    return timedOut
      ? apiError(504, "timeout", "That took too long. Please try again.")
      : apiError(502, "upstream_failed", "We couldn't create your preview. Please try again.", undefined, { upstreamStatus: status });
  } finally {
    inFlight--;
  }
}
