/**
 * VEN+ Work Item 1 — pure checkout rules.
 *
 * These mirror the authoritative server/database logic so the UI can show
 * correct totals and eligibility, and so the rules are unit-testable. The
 * server always recalculates: nothing here is trusted at checkout time.
 *
 * Funding modes are CASH_ONLY and POINTS_ONLY only.
 */

import type { OrderFundingMode, PaymentMethod } from "./points-rules";
import {
  PointsRuleError,
  deriveFundingMode,
  isPointsShippingEligible,
  linePointsTotal,
  resolvePointsPrice,
} from "./points-rules";

/** Stable, machine-readable checkout error categories (Master Prompt §90.24). */
export const CHECKOUT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "CART_EMPTY",
  "PRODUCT_INACTIVE",
  "VARIANT_INACTIVE",
  "VARIANT_NOT_FOUND",
  "INVALID_QUANTITY",
  "INSUFFICIENT_STOCK",
  "POINTS_NOT_ENABLED",
  "POINTS_PRICE_UNAVAILABLE",
  "INSUFFICIENT_POINTS",
  "SHIPPING_POINTS_NOT_ELIGIBLE",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_STATE_CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;
export type CheckoutErrorCode = (typeof CHECKOUT_ERROR_CODES)[number];

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;
  readonly detail: string | null;
  constructor(code: CheckoutErrorCode, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail ?? null;
  }
}

/** Maps a raw database/server error message onto a stable category. */
export function toCheckoutErrorCode(message: string): CheckoutErrorCode {
  const found = CHECKOUT_ERROR_CODES.find((code) => message.includes(code));
  if (found) return found;
  if (/insufficient points balance/i.test(message)) return "INSUFFICIENT_POINTS";
  return "INTERNAL_ERROR";
}

export type CheckoutLine = {
  sku: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  productActive: boolean;
  variantActive: boolean;
  stock: number;
  productCashPrice: number;
  variantCashPrice: number | null;
  pointsEnabled: boolean;
  defaultPointsPrice: number | null;
  variantPointsPrice: number | null;
  deliveryPointsReward: number;
};

export type CheckoutStoreSettings = {
  globalShippingPrice: number;
  shippingPointsPrice: number;
  freeShippingPointsThreshold: number;
  expectedDeliveryDuration: string;
};

export type CheckoutLineTotals = {
  sku: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  unitCashPrice: number;
  unitPointsPrice: number;
  lineCashTotal: number;
  linePointsTotal: number;
  deliveryPointsReward: number;
};

export type CheckoutQuote = {
  fundingMode: OrderFundingMode;
  lines: CheckoutLineTotals[];
  cashItemsTotal: number;
  pointsItemsTotal: number;
  shippingCashPrice: number;
  shippingPointsPrice: number;
  cashTotal: number;
  pointsTotal: number;
  expectedDeliveryDuration: string;
  purchasePointsReward: number;
};

/** Validates one line against authoritative catalog state. */
export function reviewLine(line: CheckoutLine): CheckoutLineTotals {
  if (!line.productActive) throw new CheckoutError("PRODUCT_INACTIVE", line.sku);
  if (!line.variantActive) throw new CheckoutError("VARIANT_INACTIVE", line.sku);
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new CheckoutError("INVALID_QUANTITY", line.sku);
  }
  if (line.stock < line.quantity) throw new CheckoutError("INSUFFICIENT_STOCK", line.sku);

  const unitCash = line.variantCashPrice ?? line.productCashPrice;

  if (line.paymentMethod === "POINTS") {
    if (!line.pointsEnabled) throw new CheckoutError("POINTS_NOT_ENABLED", line.sku);
    let unitPoints: number | null;
    try {
      unitPoints = resolvePointsPrice({
        pointsEnabled: line.pointsEnabled,
        defaultPointsPrice: line.defaultPointsPrice,
        variantPointsPrice: line.variantPointsPrice,
      });
    } catch (error) {
      if (error instanceof PointsRuleError) {
        throw new CheckoutError("POINTS_PRICE_UNAVAILABLE", line.sku);
      }
      throw error;
    }
    if (unitPoints === null) throw new CheckoutError("POINTS_PRICE_UNAVAILABLE", line.sku);
    return {
      sku: line.sku,
      quantity: line.quantity,
      paymentMethod: "POINTS",
      unitCashPrice: 0,
      unitPointsPrice: unitPoints,
      lineCashTotal: 0,
      linePointsTotal: linePointsTotal(unitPoints, line.quantity),
      deliveryPointsReward: line.deliveryPointsReward,
    };
  }

  return {
    sku: line.sku,
    quantity: line.quantity,
    paymentMethod: "CASH",
    unitCashPrice: unitCash,
    unitPointsPrice: 0,
    lineCashTotal: roundEGP(unitCash * line.quantity),
    linePointsTotal: 0,
    deliveryPointsReward: line.deliveryPointsReward,
  };
}

/** Points shipping is unlocked only by the authoritative balance threshold. */
export function isPointsShippingUnlocked(input: {
  balance: number;
  freeShippingPointsThreshold: number;
}): boolean {
  return isPointsShippingEligible(input);
}

/** Purchase reward that a delivered order would grant, from the snapshot. */
export function purchasePointsReward(lines: CheckoutLineTotals[]): number {
  return lines.reduce((total, line) => total + line.deliveryPointsReward * line.quantity, 0);
}

/**
 * Builds the authoritative quote for a cart. Rejects any cash/points mix and
 * any points requirement the balance cannot cover.
 */
export function quoteCheckout(input: {
  lines: CheckoutLine[];
  shippingPaymentMethod: PaymentMethod;
  settings: CheckoutStoreSettings;
  pointsBalance: number;
}): CheckoutQuote {
  if (input.lines.length === 0) throw new CheckoutError("CART_EMPTY");

  const lines = input.lines.map(reviewLine);
  const components: PaymentMethod[] = lines.map((line) => line.paymentMethod);

  let shippingCashPrice = 0;
  let shippingPointsPrice = 0;

  if (input.shippingPaymentMethod === "POINTS") {
    if (
      !isPointsShippingUnlocked({
        balance: input.pointsBalance,
        freeShippingPointsThreshold: input.settings.freeShippingPointsThreshold,
      })
    ) {
      throw new CheckoutError("SHIPPING_POINTS_NOT_ELIGIBLE");
    }
    shippingPointsPrice = input.settings.shippingPointsPrice;
    components.push("POINTS");
  } else {
    shippingCashPrice = input.settings.globalShippingPrice;
    if (shippingCashPrice > 0) components.push("CASH");
  }

  let fundingMode: OrderFundingMode;
  try {
    fundingMode = deriveFundingMode(components);
  } catch (error) {
    if (error instanceof PointsRuleError) {
      throw new CheckoutError("VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  const cashItemsTotal = roundEGP(lines.reduce((sum, line) => sum + line.lineCashTotal, 0));
  const pointsItemsTotal = lines.reduce((sum, line) => sum + line.linePointsTotal, 0);
  const pointsTotal = pointsItemsTotal + shippingPointsPrice;

  if (pointsTotal > input.pointsBalance) throw new CheckoutError("INSUFFICIENT_POINTS");

  return {
    fundingMode,
    lines,
    cashItemsTotal,
    pointsItemsTotal,
    shippingCashPrice,
    shippingPointsPrice,
    cashTotal: roundEGP(cashItemsTotal + shippingCashPrice),
    pointsTotal,
    expectedDeliveryDuration: input.settings.expectedDeliveryDuration,
    purchasePointsReward: purchasePointsReward(lines),
  };
}

/**
 * Deterministic request fingerprint: the same idempotency key replays only for
 * a materially identical request, otherwise the server reports a conflict.
 */
export function checkoutFingerprint(input: {
  shippingPaymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  shippingAddress: Record<string, string>;
  lines: { sku: string; quantity: number; paymentMethod: PaymentMethod }[];
}): string {
  const lines = [...input.lines]
    .map((line) => `${line.sku}|${line.quantity}|${line.paymentMethod}`)
    .sort()
    .join(",");
  const address = Object.keys(input.shippingAddress)
    .sort()
    .map((key) => `${key}=${input.shippingAddress[key] ?? ""}`)
    .join(";");
  return [
    input.shippingPaymentMethod,
    input.customerName.trim(),
    input.customerPhone.trim(),
    address,
    lines,
  ].join("#");
}

function roundEGP(amount: number): number {
  return Math.round(amount * 100) / 100;
}
