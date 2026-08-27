/**
 * VEN+ canonical points and funding rules — pure, integer-only, framework-free.
 *
 * Funding modes are CASH_ONLY and POINTS_ONLY only. No combined mode is part of the
 * canonical contract and must not be introduced anywhere.
 */

export const PAYMENT_METHODS = ["CASH", "POINTS"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_FUNDING_MODES = ["CASH_ONLY", "POINTS_ONLY", "MIXED"] as const;
export type OrderFundingMode = (typeof ORDER_FUNDING_MODES)[number];

export const POINTS_TRANSACTION_TYPES = [
  "EARN_PURCHASE",
  "EARN_REFERRAL",
  "REDEEM_PRODUCT",
  "REDEEM_SHIPPING",
  "REFUND_PRODUCT_REDEMPTION",
  "REFUND_SHIPPING_REDEMPTION",
  "ADJUSTMENT_CREDIT",
  "ADJUSTMENT_DEBIT",
] as const;
export type PointsTransactionType = (typeof POINTS_TRANSACTION_TYPES)[number];

/** Referral reward is a fixed 50 points, granted on the referee's first DELIVERED order. */
export const REFERRAL_REWARD_POINTS = 50;

export class PointsRuleError extends Error {}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new PointsRuleError(`${label} must be an integer`);
  }
}

/**
 * Derives the order funding mode from the payment method of every payable
 * component. CASH_ONLY, POINTS_ONLY, and MIXED are supported.
 */
export function deriveFundingMode(components: PaymentMethod[]): OrderFundingMode {
  if (components.length === 0) {
    throw new PointsRuleError("an order must have at least one payable component");
  }
  const hasCash = components.includes("CASH");
  const hasPoints = components.includes("POINTS");
  if (hasCash && hasPoints) {
    return "MIXED";
  }
  return hasPoints ? "POINTS_ONLY" : "CASH_ONLY";
}

/**
 * Variant-specific points price wins over the product default points price.
 * Returns null when the product is not points-enabled or no price is configured.
 */
export function resolvePointsPrice(input: {
  pointsEnabled: boolean;
  defaultPointsPrice: number | null;
  variantPointsPrice: number | null;
}): number | null {
  if (!input.pointsEnabled) return null;
  const price = input.variantPointsPrice ?? input.defaultPointsPrice;
  if (price === null || price === undefined) return null;
  assertInteger(price, "points price");
  if (price < 0) throw new PointsRuleError("points price cannot be negative");
  return price;
}

/** Total points required for a quantity of a points-funded line. */
export function linePointsTotal(unitPointsPrice: number, quantity: number): number {
  assertInteger(unitPointsPrice, "unit points price");
  assertInteger(quantity, "quantity");
  if (quantity <= 0) throw new PointsRuleError("quantity must be greater than zero");
  return unitPointsPrice * quantity;
}

/**
 * Points shipping eligibility: the authoritative balance must reach the
 * configured threshold. The threshold is eligibility only, never the debit.
 */
export function isPointsShippingEligible(input: {
  balance: number;
  freeShippingPointsThreshold: number;
}): boolean {
  assertInteger(input.balance, "balance");
  assertInteger(input.freeShippingPointsThreshold, "free shipping points threshold");
  return input.balance >= input.freeShippingPointsThreshold;
}

/**
 * Applies a signed delta to a balance. Negative resulting balances are forbidden.
 */
export function applyDelta(balance: number, delta: number): number {
  assertInteger(balance, "balance");
  assertInteger(delta, "delta");
  if (delta === 0) throw new PointsRuleError("points delta must be non-zero");
  const next = balance + delta;
  if (next < 0) {
    throw new PointsRuleError(`insufficient points balance: have ${balance}, requested ${delta}`);
  }
  return next;
}

/** Sums a ledger into a balance. The ledger is the source of accounting truth. */
export function balanceFromLedger(entries: { delta: number }[]): number {
  return entries.reduce((total, entry) => {
    assertInteger(entry.delta, "delta");
    return total + entry.delta;
  }, 0);
}

/** Purchase points are earned only on DELIVERED, never on checkout or cancellation. */
export function isPurchaseRewardDue(order: {
  status: string;
  purchaseRewardGranted: boolean;
}): boolean {
  return order.status === "DELIVERED" && !order.purchaseRewardGranted;
}

/** Referral reward: referee's first DELIVERED order, once per attribution. */
export function isReferralRewardDue(order: {
  status: string;
  referralRewardGranted: boolean;
  referrerId: string | null;
  refereeId: string | null;
  refereeHasEarlierDeliveredOrder: boolean;
}): boolean {
  if (order.status !== "DELIVERED") return false;
  if (order.referralRewardGranted) return false;
  if (!order.referrerId || !order.refereeId) return false;
  if (order.referrerId === order.refereeId) return false;
  return !order.refereeHasEarlierDeliveredOrder;
}

/** Deterministic idempotency keys so retries can never double-apply points. */
export function pointsIdempotencyKey(
  type: PointsTransactionType,
  scope: string,
  discriminator?: string,
): string {
  return [type, scope, discriminator].filter(Boolean).join(":");
}
