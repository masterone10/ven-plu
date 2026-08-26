/**
 * Work Item 3 — variant image UX rules.
 *
 * Pure, framework-free resolution of the persisted product/variant media
 * mapping. Images are real rows in `product_images`; a row is variant-scoped
 * when `variantId` is set and product-scoped when it is null. Nothing here
 * fabricates a colour: there is no hue rotation, tinting, or synthetic
 * placeholder — a variant either has its own persisted photos or falls back to
 * the shared product photos.
 */

export type MediaImage = {
  url: string;
  altEn: string | null;
  altAr: string | null;
  variantId: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

/** Primary first, then explicit sort order, then a stable url tiebreak. */
export function sortMedia(images: MediaImage[]): MediaImage[] {
  return [...images].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      a.sortOrder - b.sortOrder ||
      a.url.localeCompare(b.url),
  );
}

export function productMedia(images: MediaImage[]): MediaImage[] {
  return sortMedia(images.filter((image) => image.variantId === null));
}

export function variantMedia(images: MediaImage[], variantId: string | null): MediaImage[] {
  if (!variantId) return [];
  return sortMedia(images.filter((image) => image.variantId === variantId));
}

/**
 * Gallery for the currently selected variant: its own persisted images when it
 * has any, otherwise the shared product images. Never mixes the two, so a
 * colour variant with real photos never shows another colour.
 */
export function galleryForVariant(images: MediaImage[], variantId: string | null): MediaImage[] {
  const own = variantMedia(images, variantId);
  return own.length > 0 ? own : productMedia(images);
}

export function primaryForVariant(
  images: MediaImage[],
  variantId: string | null,
): MediaImage | null {
  return galleryForVariant(images, variantId)[0] ?? null;
}

/** True when the variant has at least one persisted image of its own. */
export function hasOwnMedia(images: MediaImage[], variantId: string | null): boolean {
  return variantMedia(images, variantId).length > 0;
}

/** Localised alt text; falls back to the product/variant name, never empty. */
export function altText(image: MediaImage | null, locale: string, fallback: string): string {
  if (!image) return fallback;
  const localized = locale === "ar" ? image.altAr : image.altEn;
  return localized?.trim() || fallback;
}
