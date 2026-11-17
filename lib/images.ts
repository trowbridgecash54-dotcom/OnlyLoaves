import type { Product } from "./types";

/**
 * Where a photo lives. Uploaded photos are in the public "photos"
 * bucket in Supabase Storage; until one is uploaded, an illustrated
 * placeholder from /public/images is shown instead.
 */

const PLACEHOLDERS: Record<string, string> = {
  "classic-sourdough": "/images/classic-sourdough.svg",
  "rosemary-garlic": "/images/rosemary-garlic.svg",
  "cinnamon-sourdough": "/images/cinnamon-sourdough.svg",
};

export const placeholderImages = {
  loaf: "/images/classic-sourdough.svg",
  hero: "/images/hero.svg",
  club: "/images/loaves.svg",
  baker: "/images/baker.svg",
};

export function photoUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/photos/${path}`;
}

/** An uploaded photo's URL, or the given placeholder. */
export function imageOr(path: string | null, placeholder: string): string {
  return path ? photoUrl(path) : placeholder;
}

export function productImage(product: Pick<Product, "image_path" | "slug">): string {
  return imageOr(product.image_path, PLACEHOLDERS[product.slug] ?? placeholderImages.loaf);
}

export const isPlaceholder = (src: string) => src.startsWith("/images/");

/* ---------- Upload checks (server side) ---------- */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Identifies an image from its first bytes, ignoring whatever type the
 * browser claimed. Returns null for anything that isn't JPEG, PNG or WebP.
 */
export function sniffImage(bytes: Uint8Array): { contentType: string; extension: string } | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", extension: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { contentType: "image/png", extension: "png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}
