import { describe, expect, it } from "vitest";
import {
  applyBulkStockToAll,
  applyBulkStockToColor,
  applyBulkStockToSize,
  buildMatrix,
  calculateColumnTotal,
  calculateGrandTotal,
  calculateRowTotal,
  extractMatrixFromVariants,
  generateVariantSku,
  getColorCode,
  getSizeCode,
  validateMatrix,
} from "./variant-matrix";

describe("VEN+ Color × Size Matrix Engine", () => {
  it("generates deterministic and unique SKUs for color × size combinations", () => {
    expect(getColorCode("أسود")).toBe("BLK");
    expect(getColorCode("أبيض")).toBe("WHT");
    expect(getColorCode("رمادي")).toBe("GRY");
    expect(getColorCode("Black")).toBe("BLK");
    expect(getColorCode("White")).toBe("WHT");

    expect(getSizeCode("S")).toBe("S");
    expect(getSizeCode("M")).toBe("M");
    expect(getSizeCode("L")).toBe("L");
    expect(getSizeCode("XL")).toBe("XL");
    expect(getSizeCode("إكس لارج")).toBe("XL");

    expect(generateVariantSku("PANT", "أسود", "M")).toBe("PANT-BLK-M");
    expect(generateVariantSku("PANT", "أبيض", "L")).toBe("PANT-WHT-L");
    expect(generateVariantSku("PANT", "رمادي", "XL")).toBe("PANT-GRY-XL");
  });

  it("generates 2 Colors × 3 Sizes = 6 real variant cells", () => {
    const colors = ["أسود", "أبيض"];
    const sizes = ["M", "L", "XL"];
    const matrix = buildMatrix(colors, sizes, [], "PANT");

    expect(matrix.length).toBe(6);
    expect(matrix.map((c) => c.sku)).toEqual([
      "PANT-BLK-M",
      "PANT-BLK-L",
      "PANT-BLK-XL",
      "PANT-WHT-M",
      "PANT-WHT-L",
      "PANT-WHT-XL",
    ]);
  });

  it("generates 3 Colors × 4 Sizes = 12 real variant cells", () => {
    const colors = ["أسود", "رمادي", "أبيض"];
    const sizes = ["S", "M", "L", "XL"];
    const matrix = buildMatrix(colors, sizes, [], "PANT");

    expect(matrix.length).toBe(12);
  });

  it("manages independent stock per cell according to user specification", () => {
    const colors = ["أسود", "أبيض"];
    const sizes = ["M", "L", "XL"];
    const matrix = buildMatrix(colors, sizes, [], "PANT");

    // Configure exact quantities
    const stockMap: Record<string, number> = {
      "PANT-BLK-M": 10,
      "PANT-BLK-L": 7,
      "PANT-BLK-XL": 3,
      "PANT-WHT-M": 5,
      "PANT-WHT-L": 8,
      "PANT-WHT-XL": 2,
    };

    for (const cell of matrix) {
      cell.stock = stockMap[cell.sku] ?? 0;
    }

    // Check individual stocks
    expect(matrix.find((c) => c.color === "أسود" && c.size === "M")?.stock).toBe(10);
    expect(matrix.find((c) => c.color === "أسود" && c.size === "L")?.stock).toBe(7);
    expect(matrix.find((c) => c.color === "أسود" && c.size === "XL")?.stock).toBe(3);

    expect(matrix.find((c) => c.color === "أبيض" && c.size === "M")?.stock).toBe(5);
    expect(matrix.find((c) => c.color === "أبيض" && c.size === "L")?.stock).toBe(8);
    expect(matrix.find((c) => c.color === "أبيض" && c.size === "XL")?.stock).toBe(2);

    // Check Row Totals
    expect(calculateRowTotal(matrix, "أسود")).toBe(20);
    expect(calculateRowTotal(matrix, "أبيض")).toBe(15);

    // Check Column Totals
    expect(calculateColumnTotal(matrix, "M")).toBe(15);
    expect(calculateColumnTotal(matrix, "L")).toBe(15);
    expect(calculateColumnTotal(matrix, "XL")).toBe(5);

    // Check Grand Total
    expect(calculateGrandTotal(matrix)).toBe(35);
  });

  it("editing single cell stock does not affect other cells or colors", () => {
    const colors = ["أسود", "أبيض"];
    const sizes = ["M", "L", "XL"];
    const matrix = buildMatrix(colors, sizes, [], "PANT");

    const blackM = matrix.find((c) => c.color === "أسود" && c.size === "M");
    const whiteM = matrix.find((c) => c.color === "أبيض" && c.size === "M");
    const blackL = matrix.find((c) => c.color === "أسود" && c.size === "L");

    if (blackM) blackM.stock = 10;
    if (whiteM) whiteM.stock = 5;
    if (blackL) blackL.stock = 7;

    // Mutate Black/M from 10 to 25
    if (blackM) blackM.stock = 25;

    expect(blackM?.stock).toBe(25);
    expect(whiteM?.stock).toBe(5);
    expect(blackL?.stock).toBe(7);
  });

  it("bulk stock operations correctly update targeted rows, columns, or all cells", () => {
    const colors = ["أسود", "أبيض"];
    const sizes = ["M", "L"];
    let matrix = buildMatrix(colors, sizes, [], "PANT");

    // Apply 20 to Black
    matrix = applyBulkStockToColor(matrix, "أسود", 20);
    expect(matrix.find((c) => c.color === "أسود" && c.size === "M")?.stock).toBe(20);
    expect(matrix.find((c) => c.color === "أسود" && c.size === "L")?.stock).toBe(20);
    expect(matrix.find((c) => c.color === "أبيض" && c.size === "M")?.stock).toBe(10); // initial

    // Apply 30 to Size L
    matrix = applyBulkStockToSize(matrix, "L", 30);
    expect(matrix.find((c) => c.color === "أسود" && c.size === "L")?.stock).toBe(30);
    expect(matrix.find((c) => c.color === "أبيض" && c.size === "L")?.stock).toBe(30);
    expect(matrix.find((c) => c.color === "أسود" && c.size === "M")?.stock).toBe(20);

    // Apply 15 to All
    matrix = applyBulkStockToAll(matrix, 15);
    expect(matrix.every((c) => c.stock === 15)).toBe(true);
    expect(calculateGrandTotal(matrix)).toBe(60);
  });

  it("restores matrix seamlessly when editing an existing product", () => {
    const existingVariants = [
      {
        id: "v-1",
        sku: "PANT-BLK-M",
        nameAr: "أسود / M",
        nameEn: "Black / M",
        stock: 10,
        cashPrice: 1500,
        pointsPrice: null,
        isActive: true,
      },
      {
        id: "v-2",
        sku: "PANT-BLK-L",
        nameAr: "أسود / L",
        nameEn: "Black / L",
        stock: 7,
        cashPrice: 1600,
        pointsPrice: null,
        isActive: true,
      },
      {
        id: "v-3",
        sku: "PANT-WHT-M",
        nameAr: "أبيض / M",
        nameEn: "White / M",
        stock: 5,
        cashPrice: null,
        pointsPrice: null,
        isActive: true,
      },
      {
        id: "v-4",
        sku: "PANT-WHT-L",
        nameAr: "أبيض / L",
        nameEn: "White / L",
        stock: 8,
        cashPrice: null,
        pointsPrice: null,
        isActive: true,
      },
    ];

    const { colors, sizes, cells } = extractMatrixFromVariants(existingVariants, "PANT");

    expect(colors).toEqual(["أسود", "أبيض"]);
    expect(sizes).toEqual(["M", "L"]);
    expect(cells.length).toBe(4);

    const cell1 = cells.find((c) => c.color === "أسود" && c.size === "M");
    expect(cell1?.id).toBe("v-1");
    expect(cell1?.sku).toBe("PANT-BLK-M");
    expect(cell1?.stock).toBe(10);
    expect(cell1?.cashPriceOverride).toBe(1500);

    const cell2 = cells.find((c) => c.color === "أسود" && c.size === "L");
    expect(cell2?.id).toBe("v-2");
    expect(cell2?.stock).toBe(7);
  });

  it("validates matrix correctness and flags invalid states", () => {
    const invalidValidation = validateMatrix([], [], []);
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors.length).toBeGreaterThan(0);

    const validCells = buildMatrix(["أسود"], ["M"], [], "PANT");
    const validResult = validateMatrix(["أسود"], ["M"], validCells);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toEqual([]);
  });
});
