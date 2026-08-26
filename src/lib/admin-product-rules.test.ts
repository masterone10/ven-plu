import { describe, expect, it } from "vitest";
import {
  AdminProductError,
  assertCategoryAssignable,
  assertProductConsistency,
  matchesSearch,
  productInputSchema,
  toAdminProductRow,
  type ProductInput,
} from "@/lib/admin-product-rules";

function baseProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return productInputSchema.parse({
    slug: "vitamin-c-serum",
    categoryId: null,
    nameEn: "Vitamin C serum",
    nameAr: "سيروم فيتامين سي",
    descriptionEn: "Brightening serum.",
    descriptionAr: "سيروم لتفتيح البشرة.",
    cashPrice: 480,
    pointsEnabled: true,
    defaultPointsPrice: 900,
    deliveryPointsReward: 40,
    isActive: true,
    variants: [
      {
        sku: "VC-SER-30",
        nameEn: "30 ml",
        nameAr: "30 مل",
        cashPrice: 480,
        pointsPrice: 900,
        stock: 24,
        isActive: true,
      },
    ],
    media: [],
    ...overrides,
  });
}

describe("admin product schema", () => {
  it("rejects a malformed slug", () => {
    expect(() => baseProduct({ slug: "Vitamin C" })).toThrow();
  });

  it("rejects a lowercase sku", () => {
    expect(() =>
      baseProduct({
        variants: [
          { sku: "vc-ser-30", nameEn: "30 ml", nameAr: "30", cashPrice: 1, pointsPrice: null, stock: 1, isActive: true },
        ],
      }),
    ).toThrow();
  });

  it("rejects a negative cash price", () => {
    expect(() => baseProduct({ cashPrice: -1 })).toThrow();
  });

  it("rejects prices with more than two decimals", () => {
    expect(() => baseProduct({ cashPrice: 10.123 })).toThrow();
  });

  it("rejects fractional or zero points prices", () => {
    expect(() => baseProduct({ defaultPointsPrice: 10.5 })).toThrow();
    expect(() => baseProduct({ defaultPointsPrice: 0 })).toThrow();
  });

  it("rejects negative stock", () => {
    expect(() =>
      baseProduct({
        variants: [
          { sku: "VC-SER-30", nameEn: "30", nameAr: "30", cashPrice: 1, pointsPrice: null, stock: -3, isActive: true },
        ],
      }),
    ).toThrow();
  });

  it("requires at least one variant", () => {
    expect(() => baseProduct({ variants: [] })).toThrow();
  });
});

describe("assertProductConsistency", () => {
  it("accepts a coherent points-enabled product", () => {
    expect(() => assertProductConsistency(baseProduct())).not.toThrow();
  });

  it("requires a default points price when points purchase is on", () => {
    const input = baseProduct({ defaultPointsPrice: null });
    expect(() => assertProductConsistency(input)).toThrow(AdminProductError);
  });

  it("rejects a default points price when points purchase is off", () => {
    const input = baseProduct({
      pointsEnabled: false,
      variants: [
        { sku: "VC-SER-30", nameEn: "30", nameAr: "30", cashPrice: 1, pointsPrice: null, stock: 1, isActive: true },
      ],
    });
    expect(() => assertProductConsistency({ ...input, defaultPointsPrice: 500 })).toThrow(
      AdminProductError,
    );
  });

  it("rejects a variant points price when the product is not points eligible", () => {
    const input = baseProduct({
      pointsEnabled: false,
      defaultPointsPrice: null,
      variants: [
        { sku: "VC-SER-30", nameEn: "30", nameAr: "30", cashPrice: 1, pointsPrice: 700, stock: 1, isActive: true },
      ],
    });
    expect(() => assertProductConsistency(input)).toThrow(/VALIDATION_ERROR/);
  });

  it("rejects duplicate variant skus", () => {
    const variant = {
      sku: "VC-SER-30",
      nameEn: "30",
      nameAr: "30",
      cashPrice: 1,
      pointsPrice: 900,
      stock: 1,
      isActive: true,
    };
    expect(() => assertProductConsistency(baseProduct({ variants: [variant, { ...variant }] }))).toThrow();
  });

  it("requires at least one active variant", () => {
    const input = baseProduct({
      variants: [
        { sku: "VC-SER-30", nameEn: "30", nameAr: "30", cashPrice: 1, pointsPrice: 900, stock: 1, isActive: false },
      ],
    });
    expect(() => assertProductConsistency(input)).toThrow();
  });

  it("rejects media pointing at an unknown variant", () => {
    const input = baseProduct({
      media: [{ url: "/a.jpg", altEn: null, altAr: null, variantSku: "NOPE", sortOrder: 0, isPrimary: true }],
    });
    expect(() => assertProductConsistency(input)).toThrow();
  });

  it("rejects two primary images in the same scope", () => {
    const input = baseProduct({
      media: [
        { url: "/a.jpg", altEn: null, altAr: null, variantSku: null, sortOrder: 0, isPrimary: true },
        { url: "/b.jpg", altEn: null, altAr: null, variantSku: null, sortOrder: 1, isPrimary: true },
      ],
    });
    expect(() => assertProductConsistency(input)).toThrow();
  });

  it("allows one primary per variant scope", () => {
    const input = baseProduct({
      media: [
        { url: "/a.jpg", altEn: null, altAr: null, variantSku: null, sortOrder: 0, isPrimary: true },
        { url: "/b.jpg", altEn: null, altAr: null, variantSku: "VC-SER-30", sortOrder: 1, isPrimary: true },
      ],
    });
    expect(() => assertProductConsistency(input)).not.toThrow();
  });
});

describe("assertCategoryAssignable", () => {
  it("accepts an active category and a null category", () => {
    expect(() => assertCategoryAssignable({ isActive: true })).not.toThrow();
    expect(() => assertCategoryAssignable(null)).not.toThrow();
  });

  it("rejects an inactive category", () => {
    expect(() => assertCategoryAssignable({ isActive: false })).toThrow(/CATEGORY_INACTIVE/);
  });
});

describe("toAdminProductRow", () => {
  const product = {
    id: "p1",
    slug: "serum",
    name_en: "Serum",
    name_ar: "سيروم",
    category_id: "c1",
    cash_price: "480.00",
    points_enabled: true,
    default_points_price: 900,
    is_active: true,
  };

  it("derives variant count and total stock from persisted rows", () => {
    const row = toAdminProductRow(
      product,
      [
        { id: "v1", points_price: 900, stock: 24, is_active: true },
        { id: "v2", points_price: null, stock: 6, is_active: false },
      ],
      { name_en: "Skincare", name_ar: "العناية" },
      "/img.jpg",
    );
    expect(row.variantCount).toBe(2);
    expect(row.activeVariantCount).toBe(1);
    expect(row.totalStock).toBe(30);
    expect(row.cashPrice).toBe(480);
    expect(row.categoryNameAr).toBe("العناية");
  });

  it("hides the points price when points purchase is off", () => {
    const row = toAdminProductRow({ ...product, points_enabled: false }, [], null, null);
    expect(row.pointsPrice).toBeNull();
    expect(row.totalStock).toBe(0);
    expect(row.categoryNameEn).toBeNull();
  });
});

describe("matchesSearch", () => {
  const row = toAdminProductRow(
    {
      id: "p1",
      slug: "silk-scrunchie-set",
      name_en: "Silk scrunchie set",
      name_ar: "طقم توكات حرير",
      category_id: null,
      cash_price: 150,
      points_enabled: false,
      default_points_price: null,
      is_active: true,
    },
    [],
    null,
    null,
  );

  it("matches on name, slug and Arabic text, and passes empty terms", () => {
    expect(matchesSearch(row, "  ")).toBe(true);
    expect(matchesSearch(row, "SCRUNCHIE")).toBe(true);
    expect(matchesSearch(row, "توكات")).toBe(true);
    expect(matchesSearch(row, "mug")).toBe(false);
  });
});
