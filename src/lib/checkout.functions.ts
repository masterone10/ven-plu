import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toCheckoutErrorCode } from "@/lib/checkout-rules";

export type PlacedOrder = {
  orderId: string;
  orderNumber: string;
  created: boolean;
};

const placeOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z
    .string()
    .trim()
    .regex(/^01\d{9}$/, "Egyptian mobile numbers must be 11 digits starting with 01"),
  shippingAddress: z.object({
    governorate: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80),
    street: z.string().trim().min(3).max(200),
    notes: z.string().trim().max(300).optional().default(""),
  }),
  shippingPaymentMethod: z.enum(["CASH", "POINTS"]),
  fingerprint: z.string().trim().min(1).max(2000),
});

/**
 * Places the order. Every business rule — prices, points prices, stock, active
 * state, funding mode, points balance, shipping eligibility — is recalculated
 * inside one database transaction, together with stock deduction, points
 * debits, the order snapshot, and the ledger entries. Retrying with the same
 * idempotency key replays the same order and creates no second effect.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => placeOrderSchema.parse(data))
  .handler(async ({ context, data }): Promise<PlacedOrder> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc("checkout_place_order", {
      _user_id: context.userId,
      _idempotency_key: data.idempotencyKey,
      _customer_name: data.customerName,
      _customer_phone: data.customerPhone,
      _shipping_address: data.shippingAddress,
      _shipping_payment_method: data.shippingPaymentMethod,
      _fingerprint: data.fingerprint,
    });

    if (error) throw new Error(toCheckoutErrorCode(error.message));

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("INTERNAL_ERROR");

    return {
      orderId: row.order_id as string,
      orderNumber: row.order_number as string,
      created: row.created as boolean,
    };
  });

export type OrderConfirmation = {
  orderNumber: string;
  status: string;
  fundingMode: string;
  shippingPaymentMethod: string;
  cashTotal: number;
  pointsTotal: number;
  shippingCashPrice: number;
  shippingPointsPrice: number;
  expectedDeliveryDuration: string | null;
  customerName: string;
  customerPhone: string;
  pointsBalance: number;
  items: {
    id: string;
    productName: { en: string; ar: string };
    variantName: { en: string; ar: string };
    sku: string;
    quantity: number;
    paymentMethod: string;
    lineCashTotal: number;
    linePointsTotal: number;
    deliveryPointsReward: number;
  }[];
};

/** Reads the immutable snapshot of the order just placed. Ownership via RLS. */
export const getOrderConfirmation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<OrderConfirmation> => {
    const { supabase, userId } = context;

    const [orderResult, itemsResult, balanceResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          `order_number, status, funding_mode, shipping_payment_method, cash_total, points_total,
           shipping_cash_price, shipping_points_price, expected_delivery_duration,
           customer_name, customer_phone`,
        )
        .eq("id", data.orderId)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select(
          `id, product_name_en, product_name_ar, variant_name_en, variant_name_ar, sku, quantity,
           product_payment_method, line_cash_total, line_points_total, delivery_points_reward`,
        )
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: true }),
      supabase.from("points_balances").select("balance").eq("user_id", userId).maybeSingle(),
    ]);

    if (orderResult.error) throw new Error(orderResult.error.message);
    if (itemsResult.error) throw new Error(itemsResult.error.message);
    if (!orderResult.data) throw new Error("FORBIDDEN");

    const order = orderResult.data;
    return {
      orderNumber: order.order_number,
      status: order.status,
      fundingMode: order.funding_mode,
      shippingPaymentMethod: order.shipping_payment_method,
      cashTotal: Number(order.cash_total),
      pointsTotal: order.points_total,
      shippingCashPrice: Number(order.shipping_cash_price),
      shippingPointsPrice: order.shipping_points_price,
      expectedDeliveryDuration: order.expected_delivery_duration,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      pointsBalance: balanceResult.data?.balance ?? 0,
      items: (itemsResult.data ?? []).map((item) => ({
        id: item.id,
        productName: { en: item.product_name_en, ar: item.product_name_ar },
        variantName: { en: item.variant_name_en, ar: item.variant_name_ar },
        sku: item.sku,
        quantity: item.quantity,
        paymentMethod: item.product_payment_method,
        lineCashTotal: Number(item.line_cash_total),
        linePointsTotal: item.line_points_total,
        deliveryPointsReward: item.delivery_points_reward,
      })),
    };
  });

/**
 * Cancels an order the caller owns and compensates it: stock is restored and
 * any redeemed points are returned through new refund ledger entries.
 */
export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ refundedPoints: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc("cancel_order_with_compensation", {
      _order_id: data.orderId,
      _actor_id: context.userId,
    });
    if (error) {
      console.error("cancel_order_with_compensation failed", error);
      throw new Error(toCheckoutErrorCode(error.message));
    }

    const row = Array.isArray(rows) ? rows[0] : rows;
    return { refundedPoints: (row?.refunded_points as number | undefined) ?? 0 };
  });
