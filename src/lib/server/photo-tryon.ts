import "server-only";
import { createDecartClient, models } from "@decartai/sdk";
import type { ServerEnv } from "./env";
import { UpstreamError } from "./decart-token";
import { sniffImageType } from "@/lib/upload";

/**
 * Provider boundary for photo try-on. Routes depend on this signature only, so another
 * image try-on provider can be added by writing one more function of the same shape.
 */
export type PhotoTryOnInput = { photo: Blob; prompt: string; reference?: Blob; signal: AbortSignal };
export type PhotoTryOn = (env: ServerEnv, input: PhotoTryOnInput) => Promise<Blob>;

/** Decart image editing (lucy-image-2): edits `photo` per `prompt`, guided by an optional reference image. */
export const decartPhotoTryOn: PhotoTryOn = async (env, { photo, prompt, reference, signal }) => {
  if (!env.decartApiKey) throw new Error("DECART_API_KEY not configured");
  const client = createDecartClient({ apiKey: env.decartApiKey });
  let result: Blob;
  try {
    result = await client.process({
      model: models.image(env.imageModel as Parameters<typeof models.image>[0]),
      prompt,
      data: photo,
      ...(reference ? { reference_image: reference } : {}),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    const m = /:\s*(\d{3})\s*-/.exec(err instanceof Error ? err.message : String(err));
    throw new UpstreamError(err instanceof Error ? err.message : String(err), m ? Number(m[1]) : null);
  }
  // Re-type from magic bytes so the browser only ever receives a known image format.
  const type = sniffImageType(new Uint8Array(await result.slice(0, 16).arrayBuffer()));
  if (!type) throw new UpstreamError(`unexpected result (type "${result.type}", ${result.size} bytes)`);
  return new Blob([result], { type });
};
