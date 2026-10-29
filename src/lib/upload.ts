/** Upload rules shared by the browser (early feedback) and the server (enforcement). */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/** Largest file we will try to decode in the browser before downscaling. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** Largest image the API accepts. The browser re-encodes to ≤1280px JPEG, which is far below this. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Whole multipart body: two images plus fields. Stays under Vercel's 4.5 MB function body limit. */
export const MAX_BODY_BYTES = 2 * MAX_IMAGE_BYTES + 64 * 1024;
export const MAX_IMAGE_SIDE = 1280;

/** Detects the real format from magic bytes; the client-declared MIME type is not trusted. */
export function sniffImageType(bytes: Uint8Array): AcceptedType | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, j) => bytes[i + j] === b);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}
