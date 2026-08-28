import { describe, expect, it } from "vitest";
import {
  extractVariantAttributes,
  resolveVariant,
  isAttributeAvailable,
} from "./variant-resolution";
import type { CatalogVariant } from "./catalog.functions";

describe("variant-resolution", () => {
  const sampleVariants: CatalogVariant[] = [
    {
      id: "v-red-xl",
      sku: "SKU-RED-XL",
      nameAr: "أحمر / XL",
      nameEn: "Red / XL",
      cashPrice: 200,
      pointsPrice: 1000,
      stock: 5,
    },
    {
      id: "v-red-l",
      sku: "SKU-RED-L",
      nameAr: "أحمر / L",
      nameEn: "Red / L",
      cashPrice: 200,
      pointsPrice: 1000,
      stock: 0, // out of stock
    },
    {
      id: "v-blue-xl",
      sku: "SKU-BLUE-XL",
      nameAr: "أزرق / XL",
      nameEn: "Blue / XL",
      cashPrice: 210,
      pointsPrice: 1050,
      stock: 8,
    },
    {
      id: "v-blue-l",
      sku: "SKU-BLUE-L",
      nameAr: "أزرق / L",
      nameEn: "Blue / L",
      cashPrice: 210,
      pointsPrice: 1050,
      stock: 2,
    },
  ];

  it("extracts multidimensional attributes cleanly for Arabic and English", () => {
    const { dimensions, parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    expect(dimensions.length).toBe(2);
    expect(dimensions[0]?.values).toContain("أحمر");
    expect(dimensions[0]?.values).toContain("أزرق");
    expect(dimensions[1]?.values).toContain("XL");
    expect(dimensions[1]?.values).toContain("L");

    expect(parsedVariants.length).toBe(4);
  });

  it("resolves the exact variant from selected attribute pairs", () => {
    const { dimensions, parsedVariants } = extractVariantAttributes(sampleVariants, "ar");
    const dim1 = dimensions[0]?.name ?? "";
    const dim2 = dimensions[1]?.name ?? "";

    const matched = resolveVariant(parsedVariants, {
      [dim1]: "أزرق",
      [dim2]: "XL",
    });

    expect(matched).not.toBeNull();
    expect(matched?.id).toBe("v-blue-xl");
    expect(matched?.sku).toBe("SKU-BLUE-XL");
  });

  it("accurately detects stock availability per combination", () => {
    const { dimensions, parsedVariants } = extractVariantAttributes(sampleVariants, "ar");
    const dim1 = dimensions[0]?.name ?? "";
    const dim2 = dimensions[1]?.name ?? "";

    // أحمر + L has 0 stock
    const statusOut = isAttributeAvailable(parsedVariants, dim2, "L", { [dim1]: "أحمر" });
    expect(statusOut.available).toBe(true);
    expect(statusOut.inStock).toBe(false);

    // أحمر + XL has 5 in stock
    const statusIn = isAttributeAvailable(parsedVariants, dim2, "XL", { [dim1]: "أحمر" });
    expect(statusIn.available).toBe(true);
    expect(statusIn.inStock).toBe(true);
  });
});
