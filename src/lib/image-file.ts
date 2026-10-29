"use client";

import { ACCEPTED_TYPES, MAX_IMAGE_SIDE, MAX_SOURCE_BYTES } from "./upload";

/**
 * Validates a picked file and re-encodes it as a ≤1280px JPEG in the browser. Re-encoding keeps uploads
 * small and drops EXIF metadata such as GPS location before anything leaves the device.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) throw new Error("Use a JPEG, PNG or WebP image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That image is too large (max 20 MB).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image couldn't be opened. Try a different one.");
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) throw new Error("That image couldn't be processed.");
    return blob;
  } finally {
    bitmap.close();
  }
}
