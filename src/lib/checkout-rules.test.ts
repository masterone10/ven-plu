import { describe, expect, it } from "vitest";
import {
  CheckoutError,
  type CheckoutLine,
  type CheckoutStoreSettings,
  checkoutFingerprint,
  isPointsShippingUnlocked,
  purchasePointsReward,
  quoteCheckout,
  reviewLine,
  toCheckoutErrorCode,
} from "./checkout-rules";

const settings: CheckoutStoreSettings = {
  globalShippingPrice: 80,
  shippingPointsPrice: 400,
  expectedDeliveryDuration: "2-5 days",
};

function line(overrides: Partial<CheckoutLine> = {}): CheckoutLine {
  return {
    sku: "VC-SER-30",
    quantity: 2,
    paymentMethod: "CASH",
    productActive: true,
    variantActive: true,
    stock: 10,
    productCashPrice: 480,
    variantCashPrice: 480,
    pointsEnabled: true,
    defaultPointsPrice: 900,
    variantPointsPrice: 900,
    deliveryPointsReward: 40,
    ...overrides,
  };
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CheckoutError);
    expect((error as CheckoutError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code} to be thrown`);
}

describe("independent shipping and product payment combinations", () => {
  it("accepts Product CASH + Shipping CASH (CASH_ONLY)", () => {
    const quote = quoteCheckout({
      lines: [line()],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 0,
    });
    expect(quote.fundingMode).toBe("CASH_ONLY");
    expect(quote.cashItemsTotal).toBe(960);
    expect(quote.shippingCashPrice).toBe(80);
    expect(quote.shippingPointsPrice).toBe(0);
    expect(quote.cashTotal).toBe(1040);
    expect(quote.pointsTotal).toBe(0);
  });

  it("accepts Product CASH + Shipping POINTS (MIXED - cash shipping is 0 EGP)", () => {
    const quote = quoteCheckout({
      lines: [line()],
      shippingPaymentMethod: "POINTS",
      settings,
      pointsBalance: 500,
    });
    expect(quote.fundingMode).toBe("MIXED");
    expect(quote.cashItemsTotal).toBe(960);
    expect(quote.shippingCashPrice).toBe(0);
    expect(quote.shippingPointsPrice).toBe(400);
    expect(quote.cashTotal).toBe(960);
    expect(quote.pointsTotal).toBe(400);
  });

  it("accepts Product POINTS + Shipping CASH (MIXED)", () => {
    const quote = quoteCheckout({
      lines: [line({ paymentMethod: "POINTS" })],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 2000,
    });
    expect(quote.fundingMode).toBe("MIXED");
    expect(quote.pointsItemsTotal).toBe(1800);
    expect(quote.shippingCashPrice).toBe(80);
    expect(quote.shippingPointsPrice).toBe(0);
    expect(quote.cashTotal).toBe(80);
    expect(quote.pointsTotal).toBe(1800);
  });

  it("accepts Product POINTS + Shipping POINTS (POINTS_ONLY)", () => {
    const quote = quoteCheckout({
      lines: [line({ paymentMethod: "POINTS" })],
      shippingPaymentMethod: "POINTS",
      settings,
      pointsBalance: 2500,
    });
    expect(quote.fundingMode).toBe("POINTS_ONLY");
    expect(quote.pointsItemsTotal).toBe(1800);
    expect(quote.shippingCashPrice).toBe(0);
    expect(quote.shippingPointsPrice).toBe(400);
    expect(quote.cashTotal).toBe(0);
    expect(quote.pointsTotal).toBe(2200);
  });
});

describe("line validation", () => {
  it("rejects an empty cart", () => {
    expectCode(
      () => quoteCheckout({ lines: [], shippingPaymentMethod: "CASH", settings, pointsBalance: 0 }),
      "CART_EMPTY",
    );
  });

  it("rejects inactive products and variants", () => {
    expectCode(() => reviewLine(line({ productActive: false })), "PRODUCT_INACTIVE");
    expectCode(() => reviewLine(line({ variantActive: false })), "VARIANT_INACTIVE");
  });

  it("rejects invalid quantities", () => {
    expectCode(() => reviewLine(line({ quantity: 0 })), "INVALID_QUANTITY");
    expectCode(() => reviewLine(line({ quantity: 1.5 })), "INVALID_QUANTITY");
  });

  it("rejects a quantity above authoritative stock", () => {
    expectCode(() => reviewLine(line({ quantity: 11, stock: 10 })), "INSUFFICIENT_STOCK");
  });

  it("rejects points payment when the product is not points-enabled", () => {
    expectCode(
      () => reviewLine(line({ paymentMethod: "POINTS", pointsEnabled: false })),
      "POINTS_NOT_ENABLED",
    );
  });

  it("rejects points payment with no configured points price", () => {
    expectCode(
      () =>
        reviewLine(
          line({ paymentMethod: "POINTS", variantPointsPrice: null, defaultPointsPrice: null }),
        ),
      "POINTS_PRICE_UNAVAILABLE",
    );
  });

  it("prefers the variant cash and points price over the product default", () => {
    expect(reviewLine(line({ variantCashPrice: 690 })).unitCashPrice).toBe(690);
    expect(
      reviewLine(line({ paymentMethod: "POINTS", variantPointsPrice: 1300 })).unitPointsPrice,
    ).toBe(1300);
  });
});

describe("points balance and shipping eligibility", () => {
  it("rejects a points order the balance cannot cover", () => {
    expectCode(
      () =>
        quoteCheckout({
          lines: [line({ paymentMethod: "POINTS" })],
          shippingPaymentMethod: "POINTS",
          settings,
          pointsBalance: 1799,
        }),
      "INSUFFICIENT_POINTS",
    );
  });

  it("never allows a points total above the balance (no negative balance)", () => {
    const quote = quoteCheckout({
      lines: [line({ paymentMethod: "POINTS" })],
      shippingPaymentMethod: "POINTS",
      settings,
      pointsBalance: 2200,
    });
    expect(2200 - quote.pointsTotal).toBe(0);
  });

  it("verifies points shipping eligibility based on points price and balance", () => {
    expect(isPointsShippingUnlocked({ balance: 399, shippingPointsPrice: 400 })).toBe(false);
    expect(isPointsShippingUnlocked({ balance: 400, shippingPointsPrice: 400 })).toBe(true);
    expect(isPointsShippingUnlocked({ balance: 500, shippingPointsPrice: 400 })).toBe(true);
    expectCode(
      () =>
        quoteCheckout({
          lines: [line({ paymentMethod: "POINTS" })],
          shippingPaymentMethod: "POINTS",
          settings,
          pointsBalance: 2199,
        }),
      "INSUFFICIENT_POINTS",
    );
  });

  it("debits the configured shipping points price, never an EGP conversion", () => {
    const quote = quoteCheckout({
      lines: [line({ paymentMethod: "POINTS" })],
      shippingPaymentMethod: "POINTS",
      settings: { ...settings, shippingPointsPrice: 120 },
      pointsBalance: 5000,
    });
    expect(quote.shippingPointsPrice).toBe(120);
    expect(quote.pointsTotal).toBe(1920);
  });
});

describe("snapshot and rewards", () => {
  it("snapshots expected delivery duration and per-line totals", () => {
    const quote = quoteCheckout({
      lines: [line({ quantity: 3 })],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 0,
    });
    expect(quote.expectedDeliveryDuration).toBe("2-5 days");
    expect(quote.lines[0]).toMatchObject({ quantity: 3, lineCashTotal: 1440, linePointsTotal: 0 });
  });

  it("computes the delivery purchase reward from the snapshot", () => {
    const quote = quoteCheckout({
      lines: [line({ quantity: 2, deliveryPointsReward: 40 })],
      shippingPaymentMethod: "CASH",
      settings,
      pointsBalance: 0,
    });
    expect(quote.purchasePointsReward).toBe(80);
    expect(purchasePointsReward([])).toBe(0);
  });
});

describe("idempotency fingerprint", () => {
  const base = {
    shippingPaymentMethod: "CASH" as const,
    customerName: "Nada",
    customerPhone: "01000000000",
    shippingAddress: { city: "Cairo", street: "1 Nile St" },
    lines: [{ sku: "A", quantity: 1, paymentMethod: "CASH" as const }],
  };

  it("is stable for the same request regardless of ordering", () => {
    expect(
      checkoutFingerprint({
        ...base,
        lines: [
          { sku: "B", quantity: 2, paymentMethod: "CASH" },
          { sku: "A", quantity: 1, paymentMethod: "CASH" },
        ],
      }),
    ).toBe(
      checkoutFingerprint({
        ...base,
        lines: [
          { sku: "A", quantity: 1, paymentMethod: "CASH" },
          { sku: "B", quantity: 2, paymentMethod: "CASH" },
        ],
      }),
    );
  });

  it("changes when the request materially changes", () => {
    expect(checkoutFingerprint(base)).not.toBe(
      checkoutFingerprint({ ...base, shippingPaymentMethod: "POINTS" }),
    );
    expect(checkoutFingerprint(base)).not.toBe(
      checkoutFingerprint({ ...base, lines: [{ sku: "A", quantity: 2, paymentMethod: "CASH" }] }),
    );
  });
});

describe("error categories", () => {
  it("maps database errors onto stable categories", () => {
    expect(toCheckoutErrorCode('... "INSUFFICIENT_STOCK"')).toBe("INSUFFICIENT_STOCK");
    expect(toCheckoutErrorCode("IDEMPOTENCY_CONFLICT")).toBe("IDEMPOTENCY_CONFLICT");
    expect(toCheckoutErrorCode("insufficient points balance: have 0")).toBe("INSUFFICIENT_POINTS");
    expect(toCheckoutErrorCode("relation carts does not exist")).toBe("INTERNAL_ERROR");
  });
});
