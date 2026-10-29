import type { Product } from "./catalog";
import type { CategoryId } from "./catalog";

/** User-facing message from one of our structured API errors (`{ error: { message } }`). */
export async function apiErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown; detail?: unknown } } | null;
  const msg = typeof body?.error?.message === "string" ? body.error.message : `Request failed (${res.status}).`;
  // `detail` is only sent by the server in development.
  return typeof body?.error?.detail === "string" ? `${msg} [dev: ${body.error.detail.slice(0, 200)}]` : msg;
}

export type TryOnItem = { product: Product; image?: Blob } | { category: CategoryId; image: Blob };

/** Sends one photo try-on request. Resolves to the result image, or throws an Error with a user-facing message. */
export async function requestPhotoTryOn(photo: Blob, item: TryOnItem, signal: AbortSignal): Promise<Blob> {
  const form = new FormData();
  form.set("photo", photo, "photo.jpg");
  if ("product" in item) form.set("productId", item.product.id);
  else form.set("category", item.category);
  if (item.image) form.set("item", item.image, "item.jpg");

  const res = await fetch("/api/v1/tryon", { method: "POST", body: form, signal, cache: "no-store" });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("The preview came back in an unexpected format.");
  return blob;
}
