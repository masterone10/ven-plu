/**
 * Server-only points engine. Every mutation goes through the database function
 * public.apply_points_transaction, which writes an immutable ledger row and
 * adjusts the balance in one transaction, keyed by an idempotency key.
 */
import type { PointsTransactionType } from "./points-rules";
import { REFERRAL_REWARD_POINTS, pointsIdempotencyKey } from "./points-rules";

export type ApplyPointsInput = {
  userId: string;
  delta: number;
  type: PointsTransactionType;
  idempotencyKey: string;
  orderId?: string | null;
  sourceReference?: string | null;
  relatedTransactionId?: string | null;
  note?: string | null;
};

export type ApplyPointsResult = {
  transactionId: string;
  balance: number;
  created: boolean;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function applyPointsTransaction(input: ApplyPointsInput): Promise<ApplyPointsResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error("points delta must be a non-zero integer");
  }
  if (!input.idempotencyKey.trim()) {
    throw new Error("idempotency key is required");
  }

  const supabase = await adminClient();
  const args: {
    _user_id: string;
    _delta: number;
    _type: PointsTransactionType;
    _idempotency_key: string;
    _order_id?: string;
    _source_reference?: string;
    _related_transaction_id?: string;
    _note?: string;
  } = {
    _user_id: input.userId,
    _delta: input.delta,
    _type: input.type,
    _idempotency_key: input.idempotencyKey,
  };
  if (input.orderId) args._order_id = input.orderId;
  if (input.sourceReference) args._source_reference = input.sourceReference;
  if (input.relatedTransactionId) args._related_transaction_id = input.relatedTransactionId;
  if (input.note) args._note = input.note;

  const { data, error } = await supabase.rpc("apply_points_transaction", args);


  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("points transaction returned no result");
  return {
    transactionId: row.transaction_id as string,
    balance: row.balance as number,
    created: row.created as boolean,
  };
}

/** Purchase reward — only ever called for an order that has reached DELIVERED. */
export function grantPurchaseReward(input: {
  userId: string;
  orderId: string;
  points: number;
}): Promise<ApplyPointsResult> {
  return applyPointsTransaction({
    userId: input.userId,
    delta: input.points,
    type: "EARN_PURCHASE",
    orderId: input.orderId,
    sourceReference: `order:${input.orderId}`,
    idempotencyKey: pointsIdempotencyKey("EARN_PURCHASE", input.orderId),
  });
}

/** Referral reward — fixed 50 points, once per referee attribution. */
export function grantReferralReward(input: {
  referrerId: string;
  refereeId: string;
  orderId: string;
}): Promise<ApplyPointsResult> {
  return applyPointsTransaction({
    userId: input.referrerId,
    delta: REFERRAL_REWARD_POINTS,
    type: "EARN_REFERRAL",
    orderId: input.orderId,
    sourceReference: `referee:${input.refereeId}`,
    idempotencyKey: pointsIdempotencyKey("EARN_REFERRAL", input.refereeId),
  });
}

/** Compensating refund for a redemption; never edits the original ledger row. */
export function refundRedemption(input: {
  userId: string;
  orderId: string;
  points: number;
  scope: "PRODUCT" | "SHIPPING";
  relatedTransactionId?: string | null;
}): Promise<ApplyPointsResult> {
  const type: PointsTransactionType =
    input.scope === "PRODUCT" ? "REFUND_PRODUCT_REDEMPTION" : "REFUND_SHIPPING_REDEMPTION";
  return applyPointsTransaction({
    userId: input.userId,
    delta: input.points,
    type,
    orderId: input.orderId,
    relatedTransactionId: input.relatedTransactionId ?? null,
    sourceReference: `order:${input.orderId}`,
    idempotencyKey: pointsIdempotencyKey(type, input.orderId),
  });
}

export async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "ADMIN" });
  if (error || data !== true) {
    throw new Error("Forbidden");
  }
}
