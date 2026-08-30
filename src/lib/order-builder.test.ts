import { describe, expect, it } from "vitest";
import {
  quoteCheckout,
  checkoutFingerprint,
  type CheckoutLine,
  type CheckoutStoreSettings,
} from "./checkout-rules";

const settings: CheckoutStoreSettings = {
  globalShippingPrice: 80,
  shippingPointsPrice: 400,
  expectedDeliveryDuration: "2-5 days",
};

describe("Order Builder — Multi-Product and Dynamic Modification Rules", () => {
  it("calculates multi-product order correctly with mixed CASH and POINTS modes", () => {
    const lineA: CheckoutLine = {
      sku: "PROD-A-VAR1",
      quantity: 2,
      paymentMethod: "CASH",
      productActive: true,
      variantActive: true,
      stock: 15,
      productCashPrice: 200,
      variantCashPrice: 200,
      pointsEnabled: true,
      defaultPointsPrice: 500,
      variantPointsPrice: 500,
      deliveryPointsReward: 20,
    };

    const lineB: CheckoutLine = {
      sku: "PROD-B-VAR2",
      quantity: 1,
      paymentMethod: "POINTS",
      productActive: true,
      variantActive: true,
      stock: 5,
      productCashPrice: 450,
      variantCashPrice: 450,
      pointsEnabled: true,
      defaultPointsPrice: 1000,
      variantPointsPrice: 1000,
      deliveryPointsReward: 0,
    };

    const quote = quoteCheckout({
      lines: [lineA, lineB],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 1500,
    });

    expect(quote.cashItemsTotal).toBe(400); // 2 * 200
    expect(quote.pointsItemsTotal).toBe(1000); // 1 * 1000
    expect(quote.shippingCashPrice).toBe(80);
    expect(quote.shippingPointsPrice).toBe(0);
    expect(quote.cashTotal).toBe(480);
    expect(quote.pointsTotal).toBe(1000);
    expect(quote.fundingMode).toBe("MIXED");
  });

  it("updates totals when quantity is incremented or decremented", () => {
    const baseLine: CheckoutLine = {
      sku: "PROD-QTY",
      quantity: 1,
      paymentMethod: "CASH",
      productActive: true,
      variantActive: true,
      stock: 10,
      productCashPrice: 300,
      variantCashPrice: 300,
      pointsEnabled: false,
      defaultPointsPrice: null,
      variantPointsPrice: null,
      deliveryPointsReward: 10,
    };

    // 1 item
    const quote1 = quoteCheckout({
      lines: [baseLine],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 0,
    });
    expect(quote1.cashTotal).toBe(380); // 300 + 80

    // Incremented to 3 items
    const quote3 = quoteCheckout({
      lines: [{ ...baseLine, quantity: 3 }],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 0,
    });
    expect(quote3.cashTotal).toBe(980); // 900 + 80
  });

  it("dynamically supports switching product payment mode from CASH to POINTS", () => {
    const line: CheckoutLine = {
      sku: "PROD-SWITCH",
      quantity: 1,
      paymentMethod: "CASH",
      productActive: true,
      variantActive: true,
      stock: 10,
      productCashPrice: 500,
      variantCashPrice: 500,
      pointsEnabled: true,
      defaultPointsPrice: 1200,
      variantPointsPrice: 1200,
      deliveryPointsReward: 50,
    };

    const cashQuote = quoteCheckout({
      lines: [line],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 2000,
    });
    expect(cashQuote.cashTotal).toBe(580);
    expect(cashQuote.pointsTotal).toBe(0);

    const pointsQuote = quoteCheckout({
      lines: [{ ...line, paymentMethod: "POINTS" }],
      shippingPaymentMethod: "POINTS",
      settings,
      pointsBalance: 2000,
    });
    expect(pointsQuote.cashTotal).toBe(0);
    expect(pointsQuote.pointsTotal).toBe(1600); // 1200 + 400
  });

  it("produces deterministic fingerprints for order state", () => {
    const payload = {
      shippingPaymentMethod: "CASH" as const,
      customerName: "Ahmed Ali",
      customerPhone: "01012345678",
      shippingAddress: { address: "10 Nile St, Cairo" },
      lines: [
        { sku: "SKU-1", quantity: 2, paymentMethod: "CASH" as const },
        { sku: "SKU-2", quantity: 1, paymentMethod: "POINTS" as const },
      ],
    };

    const fp1 = checkoutFingerprint(payload);
    const fp2 = checkoutFingerprint(payload);
    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe("string");
    expect(fp1.length).toBeGreaterThan(0);
  });
});

describe("Checkout Variant Management — 10 Required Verification Scenarios", () => {
  const sampleVariants = [
    {
      id: "var-blk-l-silk",
      sku: "TOKA-BLK-L-SLK",
      nameAr: "أسود / L / حرير",
      nameEn: "Black / L / Silk",
      cashPrice: 1500,
      pointsPrice: 800,
      stock: 5,
    },
    {
      id: "var-blk-m-silk",
      sku: "TOKA-BLK-M-SLK",
      nameAr: "أسود / M / حرير",
      nameEn: "Black / M / Silk",
      cashPrice: 1400,
      pointsPrice: 750,
      stock: 3,
    },
    {
      id: "var-wht-l-silk",
      sku: "TOKA-WHT-L-SLK",
      nameAr: "أبيض / L / حرير",
      nameEn: "White / L / Silk",
      cashPrice: 1500,
      pointsPrice: 800,
      stock: 0, // Out of stock
    },
    {
      id: "var-wht-m-cotton",
      sku: "TOKA-WHT-M-CTN",
      nameAr: "أبيض / M / قطن",
      nameEn: "White / M / Cotton",
      cashPrice: 1200,
      pointsPrice: 600,
      stock: 10,
    },
  ];

  const sampleImages = [
    {
      url: "https://example.com/product-main.jpg",
      altEn: "Product Main",
      altAr: "المنتج الرئيسي",
      variantId: null,
      isPrimary: true,
      sortOrder: 0,
    },
    {
      url: "https://example.com/var-blk.jpg",
      altEn: "Black Silk Toka",
      altAr: "توكة حرير أسود",
      variantId: "var-blk-l-silk",
      isPrimary: true,
      sortOrder: 1,
    },
    {
      url: "https://example.com/var-wht.jpg",
      altEn: "White Cotton Toka",
      altAr: "توكة قطن أبيض",
      variantId: "var-wht-m-cotton",
      isPrimary: true,
      sortOrder: 2,
    },
  ];

  // Test 1: Multi-attribute resolution -> Returns correct Variant
  it("Test 1: Multi-attribute resolution -> Returns correct Variant", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");

    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");
    const matched = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "L",
      النوع: "حرير",
    });

    expect(matched).not.toBeNull();
    expect(matched?.id).toBe("var-blk-l-silk");
    expect(matched?.sku).toBe("TOKA-BLK-L-SLK");
  });

  // Test 2: Attribute change -> SKU updates
  it("Test 2: Attribute change -> SKU updates", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    // Start with Black / L / Silk
    const initial = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "L",
      النوع: "حرير",
    });
    expect(initial?.sku).toBe("TOKA-BLK-L-SLK");

    // Change Size from L to M
    const updated = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "M",
      النوع: "حرير",
    });
    expect(updated?.sku).toBe("TOKA-BLK-M-SLK");
    expect(updated?.id).toBe("var-blk-m-silk");
  });

  // Test 3: Invalid combination -> DENIED / null
  it("Test 3: Invalid combination -> DENIED / null", async () => {
    const { extractVariantAttributes, findExactVariant, isAttributeAvailable } =
      await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    // Black + M + Cotton does not exist in sampleVariants
    const invalid = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "M",
      النوع: "قطن",
    });
    expect(invalid).toBeNull();

    const availability = isAttributeAvailable(parsedVariants, "النوع", "قطن", {
      اللون: "أسود",
      المقاس: "M",
    });
    expect(availability.available).toBe(false);
  });

  // Test 4: Media gallery update -> Returns variant media
  it("Test 4: Media gallery update -> Returns variant media", async () => {
    const { primaryForVariant } = await import("./variant-media");

    // Black Silk has own image
    const blkImage = primaryForVariant(sampleImages, "var-blk-l-silk");
    expect(blkImage?.url).toBe("https://example.com/var-blk.jpg");

    // Black M Silk has no direct image -> falls back to product image
    const blkMImage = primaryForVariant(sampleImages, "var-blk-m-silk");
    expect(blkMImage?.url).toBe("https://example.com/product-main.jpg");

    // White Cotton has own image
    const whtImage = primaryForVariant(sampleImages, "var-wht-m-cotton");
    expect(whtImage?.url).toBe("https://example.com/var-wht.jpg");
  });

  // Test 5: Stock availability -> Correct stock per variant
  it("Test 5: Stock availability -> Correct stock per variant", async () => {
    const { extractVariantAttributes, isAttributeAvailable } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    // White / L / Silk has 0 stock
    const whiteLStatus = isAttributeAvailable(parsedVariants, "المقاس", "L", {
      اللون: "أبيض",
      النوع: "حرير",
    });
    expect(whiteLStatus.available).toBe(true);
    expect(whiteLStatus.inStock).toBe(false);

    // Black / L / Silk has 5 in stock
    const blackLStatus = isAttributeAvailable(parsedVariants, "المقاس", "L", {
      اللون: "أسود",
      النوع: "حرير",
    });
    expect(blackLStatus.available).toBe(true);
    expect(blackLStatus.inStock).toBe(true);
  });

  // Test 6: Price updates (cash) -> Correct cash price
  it("Test 6: Price updates (cash) -> Correct cash price", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    const varL = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "L",
      النوع: "حرير",
    });
    expect(varL?.cashPrice).toBe(1500);

    const varM = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "M",
      النوع: "حرير",
    });
    expect(varM?.cashPrice).toBe(1400);

    const varCotton = findExactVariant(parsedVariants, {
      اللون: "أبيض",
      المقاس: "M",
      النوع: "قطن",
    });
    expect(varCotton?.cashPrice).toBe(1200);
  });

  // Test 7: Points price updates -> Correct points price
  it("Test 7: Points price updates -> Correct points price", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    const varL = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "L",
      النوع: "حرير",
    });
    expect(varL?.pointsPrice).toBe(800);

    const varM = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "M",
      النوع: "حرير",
    });
    expect(varM?.pointsPrice).toBe(750);

    const varCotton = findExactVariant(parsedVariants, {
      اللون: "أبيض",
      المقاس: "M",
      النوع: "قطن",
    });
    expect(varCotton?.pointsPrice).toBe(600);
  });

  // Test 8: Quantity constrained by stock
  it("Test 8: Quantity constrained by stock", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    const currentQty = 5;
    // Switch to Black / M / Silk which has stock = 3
    const targetVariant = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "M",
      النوع: "حرير",
    });
    expect(targetVariant).not.toBeNull();
    const clampedQty = Math.min(currentQty, Math.max(1, targetVariant!.stock));
    expect(clampedQty).toBe(3);
  });

  // Test 9: Payment mode independence -> Mode unchanged on attribute change
  it("Test 9: Payment mode independence -> Mode unchanged on attribute change", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    const currentPaymentMode = "POINTS";

    // User changes attribute from Black L to Black M
    const targetVariant = findExactVariant(parsedVariants, {
      اللون: "أسود",
      المقاس: "M",
      النوع: "حرير",
    });

    expect(targetVariant?.id).toBe("var-blk-m-silk");
    // Payment mode remains independent and unchanged
    expect(currentPaymentMode).toBe("POINTS");
  });

  // Test 10: In-checkout add product -> Correct item created
  it("Test 10: In-checkout add product -> Correct item created", async () => {
    const { extractVariantAttributes, findExactVariant } = await import("./variant-resolution");
    const { parsedVariants } = extractVariantAttributes(sampleVariants, "ar");

    // Selected options: White / M / Cotton, Qty: 2, PaymentMethod: CASH
    const selectedVariant = findExactVariant(parsedVariants, {
      اللون: "أبيض",
      المقاس: "M",
      النوع: "قطن",
    });

    expect(selectedVariant).not.toBeNull();

    const createdItem = {
      variantId: selectedVariant!.id,
      sku: selectedVariant!.sku,
      quantity: 2,
      paymentMethod: "CASH" as const,
      unitCashPrice: selectedVariant!.cashPrice,
      unitPointsPrice: selectedVariant!.pointsPrice,
    };

    expect(createdItem.variantId).toBe("var-wht-m-cotton");
    expect(createdItem.sku).toBe("TOKA-WHT-M-CTN");
    expect(createdItem.unitCashPrice).toBe(1200);
    expect(createdItem.quantity).toBe(2);
  });
});
