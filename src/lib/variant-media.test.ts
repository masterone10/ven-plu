import { describe, expect, it } from "vitest";
import {
  altText,
  galleryForVariant,
  hasOwnMedia,
  primaryForVariant,
  productMedia,
  sortMedia,
  variantMedia,
  type MediaImage,
} from "./variant-media";

const img = (over: Partial<MediaImage>): MediaImage => ({
  url: "/a.jpg",
  altEn: null,
  altAr: null,
  variantId: null,
  isPrimary: false,
  sortOrder: 0,
  ...over,
});

const productPhoto = img({ url: "/product.jpg", isPrimary: true, altEn: "Serum", altAr: "سيروم" });
const black = img({ url: "/black.jpg", variantId: "v-black", altEn: "Black", altAr: "أسود" });
const blackAlt = img({ url: "/black-2.jpg", variantId: "v-black", sortOrder: 1 });
const brown = img({ url: "/brown.jpg", variantId: "v-brown", altEn: "Brown", altAr: "بني" });
const all = [brown, blackAlt, productPhoto, black];

describe("sortMedia", () => {
  it("puts the primary image first, then sort order", () => {
    const sorted = sortMedia([img({ url: "/b.jpg", sortOrder: 2 }), img({ url: "/c.jpg", sortOrder: 1 }), productPhoto]);
    expect(sorted.map((i) => i.url)).toEqual(["/product.jpg", "/c.jpg", "/b.jpg"]);
  });

  it("does not mutate its input", () => {
    const input = [blackAlt, black];
    sortMedia(input);
    expect(input.map((i) => i.url)).toEqual(["/black-2.jpg", "/black.jpg"]);
  });
});

describe("productMedia / variantMedia", () => {
  it("separates shared product images from variant-scoped images", () => {
    expect(productMedia(all).map((i) => i.url)).toEqual(["/product.jpg"]);
    expect(variantMedia(all, "v-black").map((i) => i.url)).toEqual(["/black.jpg", "/black-2.jpg"]);
  });

  it("returns nothing for a null variant", () => {
    expect(variantMedia(all, null)).toEqual([]);
  });
});

describe("galleryForVariant", () => {
  it("shows only the selected variant's real photos", () => {
    expect(galleryForVariant(all, "v-brown").map((i) => i.url)).toEqual(["/brown.jpg"]);
  });

  it("never leaks another variant's photos into the gallery", () => {
    const urls = galleryForVariant(all, "v-black").map((i) => i.url);
    expect(urls).not.toContain("/brown.jpg");
    expect(urls).not.toContain("/product.jpg");
  });

  it("falls back to the shared product photos when the variant has none", () => {
    expect(galleryForVariant(all, "v-unknown").map((i) => i.url)).toEqual(["/product.jpg"]);
  });

  it("returns an empty gallery when nothing is persisted", () => {
    expect(galleryForVariant([], "v-black")).toEqual([]);
  });
});

describe("primaryForVariant", () => {
  it("changes when the selected variant changes", () => {
    expect(primaryForVariant(all, "v-black")?.url).toBe("/black.jpg");
    expect(primaryForVariant(all, "v-brown")?.url).toBe("/brown.jpg");
  });

  it("is null when there is no media at all", () => {
    expect(primaryForVariant([], "v-black")).toBeNull();
  });
});

describe("hasOwnMedia", () => {
  it("distinguishes real variant media from fallback", () => {
    expect(hasOwnMedia(all, "v-black")).toBe(true);
    expect(hasOwnMedia(all, "v-unknown")).toBe(false);
  });
});

describe("altText", () => {
  it("uses the locale-specific alt text", () => {
    expect(altText(black, "en", "fallback")).toBe("Black");
    expect(altText(black, "ar", "fallback")).toBe("أسود");
  });

  it("falls back when alt text is missing or blank", () => {
    expect(altText(blackAlt, "en", "Silk scrunchie")).toBe("Silk scrunchie");
    expect(altText(img({ altEn: "   " }), "en", "Serum")).toBe("Serum");
    expect(altText(null, "ar", "سيروم")).toBe("سيروم");
  });
});
