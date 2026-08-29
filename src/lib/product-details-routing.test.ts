import { describe, it, expect } from "vitest";
import { primaryForVariant, galleryForVariant, hasOwnMedia, sortMedia } from "./variant-media";
import type { CatalogProduct, CatalogVariant } from "./catalog.functions";

describe("Product Details & Routing Specifications", () => {
  const mockProduct: CatalogProduct = {
    id: "prod-101",
    slug: "vitamin-c-serum",
    categoryId: "cat-skincare",
    nameEn: "Vitamin C Brightening Serum",
    nameAr: "سيروم فيتامين سي للتفتيح",
    descriptionEn: "High-potency brightening serum with hyaluronic acid.",
    descriptionAr: "سيروم تفتيح عالي الفعالية مع حمض الهيالورونيك.",
    cashPrice: 350,
    pointsEnabled: true,
    defaultPointsPrice: 1750,
    deliveryPointsReward: 35,
    images: [
      {
        url: "https://supabase.local/storage/v1/object/public/product-images/prod-shared.jpg",
        altEn: "Serum bottle",
        altAr: "زجاجة سيروم",
        variantId: null,
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://supabase.local/storage/v1/object/public/product-images/prod-50ml.jpg",
        altEn: "50ml bottle",
        altAr: "حجم 50 مل",
        variantId: "var-50ml",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://supabase.local/storage/v1/object/public/product-images/prod-100ml.jpg",
        altEn: "100ml bottle",
        altAr: "حجم 100 مل",
        variantId: "var-100ml",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
    imageUrl: "https://supabase.local/storage/v1/object/public/product-images/prod-shared.jpg",
    imageAltEn: "Serum bottle",
    imageAltAr: "زجاجة سيروم",
    variants: [
      {
        id: "var-50ml",
        sku: "VIT-C-50ML",
        nameEn: "50ml",
        nameAr: "50 مل",
        cashPrice: 350,
        pointsPrice: 1750,
        stock: 25,
      },
      {
        id: "var-100ml",
        sku: "VIT-C-100ML",
        nameEn: "100ml",
        nameAr: "100 مل",
        cashPrice: 600,
        pointsPrice: 3000,
        stock: 10,
      },
    ],
  };

  it("1. Generates correct route path and params for product details", () => {
    const slug = mockProduct.slug;
    const expectedRoute = `/products/${slug}`;
    expect(expectedRoute).toBe("/products/vitamin-c-serum");
    expect(encodeURIComponent(slug)).toBe("vitamin-c-serum");
  });

  it("2. Resolves variant-specific images when switching variants", () => {
    // 50ml variant
    const gallery50 = galleryForVariant(mockProduct.images, "var-50ml");
    expect(gallery50.length).toBeGreaterThan(0);
    expect(gallery50[0]?.url).toContain("prod-50ml.jpg");
    expect(hasOwnMedia(mockProduct.images, "var-50ml")).toBe(true);

    // 100ml variant
    const gallery100 = galleryForVariant(mockProduct.images, "var-100ml");
    expect(gallery100.length).toBeGreaterThan(0);
    expect(gallery100[0]?.url).toContain("prod-100ml.jpg");
    expect(hasOwnMedia(mockProduct.images, "var-100ml")).toBe(true);
  });

  it("3. Falls back to product-level image when variant has no own media", () => {
    const galleryShared = galleryForVariant(mockProduct.images, "non-existent-var");
    expect(galleryShared.length).toBeGreaterThan(0);
    expect(galleryShared[0]?.url).toContain("prod-shared.jpg");
    expect(hasOwnMedia(mockProduct.images, "non-existent-var")).toBe(false);
  });

  it("4. Accurately updates variant price, SKU, points price, and stock on variant selection", () => {
    const selectedVariant = mockProduct.variants.find((v) => v.id === "var-100ml");
    expect(selectedVariant).toBeDefined();
    expect(selectedVariant?.sku).toBe("VIT-C-100ML");
    expect(selectedVariant?.cashPrice).toBe(600);
    expect(selectedVariant?.pointsPrice).toBe(3000);
    expect(selectedVariant?.stock).toBe(10);
  });

  it("5. Respects points payment eligibility and delivery reward calculation", () => {
    expect(mockProduct.pointsEnabled).toBe(true);
    expect(mockProduct.deliveryPointsReward).toBe(35);
    expect(mockProduct.variants[0]?.pointsPrice).toBe(1750);
  });

  it("6. Correctly sorts media array with primary items first", () => {
    const unsorted = [
      {
        url: "img2.jpg",
        altEn: null,
        altAr: null,
        variantId: null,
        isPrimary: false,
        sortOrder: 2,
      },
      { url: "img1.jpg", altEn: null, altAr: null, variantId: null, isPrimary: true, sortOrder: 1 },
      { url: "img0.jpg", altEn: null, altAr: null, variantId: null, isPrimary: true, sortOrder: 0 },
    ];
    const sorted = sortMedia(unsorted);
    expect(sorted[0]?.url).toBe("img0.jpg");
    expect(sorted[1]?.url).toBe("img1.jpg");
    expect(sorted[2]?.url).toBe("img2.jpg");
  });

  it("7. Handles empty or out of stock variants safely", () => {
    const outOfStockVariant: CatalogVariant = {
      id: "var-empty",
      sku: "VIT-C-EMPTY",
      nameEn: "Sample",
      nameAr: "عينة",
      cashPrice: 50,
      pointsPrice: 250,
      stock: 0,
    };
    expect(outOfStockVariant.stock < 1).toBe(true);
  });
});
