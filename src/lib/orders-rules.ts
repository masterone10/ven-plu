/**
 * VEN+ Work Item 2 — pure customer order retrieval rules.
 *
 * Everything here operates on the IMMUTABLE order snapshot rows
 * (`orders`, `order_items`, `points_transactions`). Current catalog data is
 * never consulted: historical names, SKUs and unit prices come from the
 * snapshot written at checkout time.
 *
 * Funding modes are CASH_ONLY and POINTS_ONLY only — no third, combined mode.
 */

export const ORDER_FUNDING_MODES = ["CASH_ONLY", "POINTS_ONLY"] as const;
export type OrderFundingMode = (typeof ORDER_FUNDING_MODES)[number];

export const ORDER_STATUSES = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderPaymentMethod = "CASH" | "POINTS";

/** Order retrieval error categories. Kept deliberately non-leaking. */
export type OrderErrorCode = "UNAUTHENTICATED" | "ORDER_NOT_FOUND" | "INTERNAL_ERROR";

export class OrderRetrievalError extends Error {
  readonly code: OrderErrorCode;
  constructor(code: OrderErrorCode) {
    super(code);
    this.code = code;
  }
}

/**
 * A non-owned or fabricated order id must be indistinguishable from a missing
 * one, so ownership failures and absent rows collapse to ORDER_NOT_FOUND.
 */
export function orderNotFound(): OrderRetrievalError {
  return new OrderRetrievalError("ORDER_NOT_FOUND");
}

export function assertFundingMode(value: string): OrderFundingMode {
  if (value === "CASH_ONLY" || value === "POINTS_ONLY") return value;
  throw new OrderRetrievalError("INTERNAL_ERROR");
}

export function assertOrderStatus(value: string): OrderStatus {
  const found = ORDER_STATUSES.find((status) => status === value);
  if (!found) throw new OrderRetrievalError("INTERNAL_ERROR");
  return found;
}

export const ORDER_PAGE_SIZE = 10;
export const ORDER_PAGE_SIZE_MAX = 50;

export type Pagination = { page: number; pageSize: number; from: number; to: number };

/** Clamps client-supplied paging so a caller cannot ask for unbounded reads. */
export function normalizePagination(input?: {
  page?: number | undefined;
  pageSize?: number | undefined;
}): Pagination {
  const rawPage = Math.floor(input?.page ?? 1);
  const rawSize = Math.floor(input?.pageSize ?? ORDER_PAGE_SIZE);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawSize)
    ? Math.min(Math.max(rawSize, 1), ORDER_PAGE_SIZE_MAX)
    : ORDER_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function pageCount(total: number, pageSize: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / Math.max(pageSize, 1));
}

/** Raw snapshot row shapes, as stored at checkout time. */
export type OrderSnapshotRow = {
  id: string;
  order_number: string;
  status: string;
  funding_mode: string;
  shipping_payment_method: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: unknown;
  shipping_cash_price: number | string;
  shipping_points_price: number;
  cash_total: number | string;
  points_total: number;
  expected_delivery_duration: string | null;
  created_at: string;
  confirmed_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
};

export type OrderItemSnapshotRow = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_en: string;
  product_name_ar: string;
  variant_name_en: string;
  variant_name_ar: string;
  sku: string;
  quantity: number;
  product_payment_method: string;
  unit_cash_price: number | string;
  unit_points_price: number;
  line_cash_total: number | string;
  line_points_total: number;
  delivery_points_reward: number;
};

export type PointsLedgerRow = { type: string; delta: number };

export type ShippingAddress = {
  governorate: string;
  city: string;
  street: string;
  notes: string;
};

export type OrderItemView = {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: { en: string; ar: string };
  variantName: { en: string; ar: string };
  sku: string;
  quantity: number;
  paymentMethod: OrderPaymentMethod;
  unitCashPrice: number;
  unitPointsPrice: number;
  lineCashTotal: number;
  linePointsTotal: number;
  deliveryPointsReward: number;
};

export type OrderSummaryView = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fundingMode: OrderFundingMode;
  createdAt: string;
  cashTotal: number;
  pointsTotal: number;
  itemCount: number;
};

export type OrderPointsView = {
  pointsCharged: number;
  pointsRefunded: number;
  pointsEarned: number;
};

export type OrderDetailView = OrderSummaryView & {
  shippingPaymentMethod: OrderPaymentMethod;
  shippingCashPrice: number;
  shippingPointsPrice: number;
  expectedDeliveryDuration: string | null;
  customerName: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItemView[];
  points: OrderPointsView;
};

function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPaymentMethod(value: string): OrderPaymentMethod {
  if (value === "CASH" || value === "POINTS") return value;
  throw new OrderRetrievalError("INTERNAL_ERROR");
}

export function normalizeShippingAddress(value: unknown): ShippingAddress {
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  return {
    governorate: text("governorate"),
    city: text("city"),
    street: text("street"),
    notes: text("notes"),
  };
}

export function formatShippingAddress(address: ShippingAddress): string {
  return [address.street, address.city, address.governorate].filter((part) => part.length > 0).join(", ");
}

/** Cash/points composition of a stored order, derived from snapshot values. */
export function toOrderSummary(row: OrderSnapshotRow, itemCount: number): OrderSummaryView {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: assertOrderStatus(row.status),
    fundingMode: assertFundingMode(row.funding_mode),
    createdAt: row.created_at,
    cashTotal: toNumber(row.cash_total),
    pointsTotal: row.points_total,
    itemCount,
  };
}

export function toOrderItemView(row: OrderItemSnapshotRow): OrderItemView {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    productName: { en: row.product_name_en, ar: row.product_name_ar },
    variantName: { en: row.variant_name_en, ar: row.variant_name_ar },
    sku: row.sku,
    quantity: row.quantity,
    paymentMethod: toPaymentMethod(row.product_payment_method),
    unitCashPrice: toNumber(row.unit_cash_price),
    unitPointsPrice: row.unit_points_price,
    lineCashTotal: toNumber(row.line_cash_total),
    linePointsTotal: row.line_points_total,
    deliveryPointsReward: row.delivery_points_reward,
  };
}

/** Points charged / refunded / earned for one order, read from the ledger. */
export function summarizeOrderPoints(rows: PointsLedgerRow[]): OrderPointsView {
  let charged = 0;
  let refunded = 0;
  let earned = 0;
  for (const row of rows) {
    if (row.type === "REDEEM_PRODUCT" || row.type === "REDEEM_SHIPPING") {
      charged += Math.abs(row.delta);
    } else if (
      row.type === "REFUND_PRODUCT_REDEMPTION" ||
      row.type === "REFUND_SHIPPING_REDEMPTION"
    ) {
      refunded += Math.abs(row.delta);
    } else if (row.type === "EARN_PURCHASE" || row.type === "EARN_REFERRAL") {
      earned += Math.abs(row.delta);
    }
  }
  return { pointsCharged: charged, pointsRefunded: refunded, pointsEarned: earned };
}

export function toOrderDetail(
  row: OrderSnapshotRow,
  itemRows: OrderItemSnapshotRow[],
  ledgerRows: PointsLedgerRow[],
): OrderDetailView {
  const items = itemRows.map(toOrderItemView);
  return {
    ...toOrderSummary(row, items.length),
    shippingPaymentMethod: toPaymentMethod(row.shipping_payment_method),
    shippingCashPrice: toNumber(row.shipping_cash_price),
    shippingPointsPrice: row.shipping_points_price,
    expectedDeliveryDuration: row.expected_delivery_duration,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    shippingAddress: normalizeShippingAddress(row.shipping_address),
    confirmedAt: row.confirmed_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    items,
    points: summarizeOrderPoints(ledgerRows),
  };
}

/** Orders the customer may still cancel themselves (Work Item 1 behaviour). */
export function isCustomerCancellable(status: OrderStatus): boolean {
  return status === "PENDING_CONFIRMATION" || status === "CONFIRMED" || status === "PROCESSING";
}
