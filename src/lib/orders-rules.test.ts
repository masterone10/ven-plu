import { describe, expect, it } from "vitest";
import {
  ORDER_FUNDING_MODES,
  ORDER_PAGE_SIZE,
  OrderRetrievalError,
  type OrderItemSnapshotRow,
  type OrderSnapshotRow,
  assertFundingMode,
  assertOrderStatus,
  formatShippingAddress,
  isCustomerCancellable,
  normalizePagination,
  normalizeShippingAddress,
  orderNotFound,
  pageCount,
  summarizeOrderPoints,
  toOrderDetail,
  toOrderItemView,
  toOrderSummary,
} from "./orders-rules";

const orderRow: OrderSnapshotRow = {
  id: "11111111-1111-1111-1111-111111111111",
  order_number: "VP-1000",
  status: "PENDING_CONFIRMATION",
  funding_mode: "CASH_ONLY",
  shipping_payment_method: "CASH",
  customer_name: "Zaid Customer",
  customer_phone: "01012345678",
  shipping_address: { governorate: "Cairo", city: "Nasr City", street: "12 Ahmed St", notes: "" },
  shipping_cash_price: "60.00",
  shipping_points_price: 0,
  cash_total: "1020.00",
  points_total: 0,
  expected_delivery_duration: "2-5 days",
  created_at: "2026-08-24T10:00:00.000Z",
  confirmed_at: null,
  delivered_at: null,
  cancelled_at: null,
};

const itemRow: OrderItemSnapshotRow = {
  id: "22222222-2222-2222-2222-222222222222",
  product_id: "33333333-3333-3333-3333-333333333333",
  variant_id: "44444444-4444-4444-4444-444444444444",
  product_name_en: "Vitamin C Serum",
  product_name_ar: "سيروم فيتامين سي",
  variant_name_en: "30 ml",
  variant_name_ar: "30 مل",
  sku: "VC-SER-30",
  quantity: 2,
  product_payment_method: "CASH",
  unit_cash_price: "480.00",
  unit_points_price: 0,
  line_cash_total: "960.00",
  line_points_total: 0,
  delivery_points_reward: 40,
};

describe("funding mode", () => {
  it("only accepts CASH_ONLY and POINTS_ONLY", () => {
    expect(ORDER_FUNDING_MODES).toEqual(["CASH_ONLY", "POINTS_ONLY"]);
    expect(assertFundingMode("CASH_ONLY")).toBe("CASH_ONLY");
    expect(assertFundingMode("POINTS_ONLY")).toBe("POINTS_ONLY");
  });

  it("accepts only the two canonical funding modes and rejects anything else", () => {
    expect(() => assertFundingMode("CASH_AND_POINTS")).toThrow(OrderRetrievalError);
    expect(() => assertFundingMode("cash_only")).toThrow(OrderRetrievalError);
    expect(() => assertFundingMode("CASH")).toThrow(OrderRetrievalError);
    expect(() => assertFundingMode("")).toThrow(OrderRetrievalError);
  });

  it("rejects unknown statuses", () => {
    expect(assertOrderStatus("DELIVERED")).toBe("DELIVERED");
    expect(() => assertOrderStatus("REFUNDED")).toThrow(OrderRetrievalError);
  });
});

describe("ownership error shape", () => {
  it("collapses non-owned and fabricated ids to ORDER_NOT_FOUND", () => {
    const error = orderNotFound();
    expect(error.code).toBe("ORDER_NOT_FOUND");
    expect(error.message).toBe("ORDER_NOT_FOUND");
    // No detail that could distinguish "exists but not yours" from "missing".
    expect(Object.keys(error)).not.toContain("orderId");
  });
});

describe("pagination", () => {
  it("defaults to page 1 with the default page size", () => {
    expect(normalizePagination()).toEqual({ page: 1, pageSize: ORDER_PAGE_SIZE, from: 0, to: 9 });
  });

  it("computes range offsets", () => {
    expect(normalizePagination({ page: 3, pageSize: 5 })).toEqual({
      page: 3,
      pageSize: 5,
      from: 10,
      to: 14,
    });
  });

  it("clamps hostile paging input", () => {
    expect(normalizePagination({ page: -4, pageSize: 5000 }).page).toBe(1);
    expect(normalizePagination({ page: -4, pageSize: 5000 }).pageSize).toBe(50);
    expect(normalizePagination({ pageSize: 0 }).pageSize).toBe(1);
    expect(normalizePagination({ page: Number.NaN }).page).toBe(1);
  });

  it("counts pages", () => {
    expect(pageCount(0, 10)).toBe(0);
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
  });
});

describe("snapshot mapping", () => {
  it("maps the order snapshot without touching catalog data", () => {
    const summary = toOrderSummary(orderRow, 1);
    expect(summary).toEqual({
      id: orderRow.id,
      orderNumber: "VP-1000",
      status: "PENDING_CONFIRMATION",
      fundingMode: "CASH_ONLY",
      createdAt: "2026-08-24T10:00:00.000Z",
      cashTotal: 1020,
      pointsTotal: 0,
      itemCount: 1,
    });
  });

  it("maps historical names, SKU and unit prices from the item snapshot", () => {
    const view = toOrderItemView(itemRow);
    expect(view.productName).toEqual({ en: "Vitamin C Serum", ar: "سيروم فيتامين سي" });
    expect(view.variantName.en).toBe("30 ml");
    expect(view.sku).toBe("VC-SER-30");
    expect(view.quantity).toBe(2);
    expect(view.unitCashPrice).toBe(480);
    expect(view.lineCashTotal).toBe(960);
    expect(view.paymentMethod).toBe("CASH");
  });

  it("keeps historical values stable when current catalog data changes", () => {
    // Simulates the catalog being renamed/repriced after the order was placed.
    const renamedCatalog = { name_en: "Vitamin C Serum PRO", cash_price: 999 };
    const view = toOrderItemView(itemRow);
    expect(view.productName.en).not.toBe(renamedCatalog.name_en);
    expect(view.unitCashPrice).not.toBe(renamedCatalog.cash_price);
    expect(view.unitCashPrice).toBe(480);
  });

  it("builds the full detail view including shipping and points composition", () => {
    const detail = toOrderDetail(
      { ...orderRow, funding_mode: "POINTS_ONLY", shipping_payment_method: "POINTS" },
      [{ ...itemRow, product_payment_method: "POINTS", unit_points_price: 900, line_points_total: 1800 }],
      [
        { type: "REDEEM_PRODUCT", delta: -1800 },
        { type: "REDEEM_SHIPPING", delta: -100 },
      ],
    );
    expect(detail.fundingMode).toBe("POINTS_ONLY");
    expect(detail.shippingPaymentMethod).toBe("POINTS");
    expect(detail.items[0]?.unitPointsPrice).toBe(900);
    expect(detail.points).toEqual({ pointsCharged: 1900, pointsRefunded: 0, pointsEarned: 0 });
    expect(detail.shippingAddress.city).toBe("Nasr City");
  });

  it("normalizes and formats a shipping address defensively", () => {
    expect(normalizeShippingAddress(null)).toEqual({
      governorate: "",
      city: "",
      street: "",
      notes: "",
    });
    expect(formatShippingAddress(normalizeShippingAddress(orderRow.shipping_address))).toBe(
      "12 Ahmed St, Nasr City, Cairo",
    );
  });
});

describe("points composition per order", () => {
  it("separates charges, refunds and rewards", () => {
    expect(
      summarizeOrderPoints([
        { type: "REDEEM_PRODUCT", delta: -900 },
        { type: "REDEEM_SHIPPING", delta: -100 },
        { type: "REFUND_PRODUCT_REDEMPTION", delta: 900 },
        { type: "REFUND_SHIPPING_REDEMPTION", delta: 100 },
        { type: "EARN_PURCHASE", delta: 40 },
        { type: "EARN_REFERRAL", delta: 50 },
      ]),
    ).toEqual({ pointsCharged: 1000, pointsRefunded: 1000, pointsEarned: 90 });
  });

  it("reports zero for a cash-only order", () => {
    expect(summarizeOrderPoints([])).toEqual({
      pointsCharged: 0,
      pointsRefunded: 0,
      pointsEarned: 0,
    });
  });

  it("shows a cancellation refund exactly once even if read twice", () => {
    const ledger = [
      { type: "REDEEM_PRODUCT", delta: -900 },
      { type: "REFUND_PRODUCT_REDEMPTION", delta: 900 },
    ];
    expect(summarizeOrderPoints(ledger).pointsRefunded).toBe(900);
    expect(summarizeOrderPoints(ledger).pointsRefunded).toBe(900);
  });
});

describe("cancellable statuses", () => {
  it("matches the Work Item 1 contract", () => {
    expect(isCustomerCancellable("PENDING_CONFIRMATION")).toBe(true);
    expect(isCustomerCancellable("CONFIRMED")).toBe(true);
    expect(isCustomerCancellable("PROCESSING")).toBe(true);
    expect(isCustomerCancellable("SHIPPED")).toBe(false);
    expect(isCustomerCancellable("DELIVERED")).toBe(false);
    expect(isCustomerCancellable("CANCELLED")).toBe(false);
  });
});
