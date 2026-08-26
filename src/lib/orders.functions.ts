import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORDER_PAGE_SIZE,
  ORDER_PAGE_SIZE_MAX,
  type OrderDetailView,
  type OrderSummaryView,
  normalizePagination,
  orderNotFound,
  pageCount,
  toOrderDetail,
  toOrderSummary,
} from "@/lib/orders-rules";

export type OrderListPage = {
  orders: OrderSummaryView[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

const listSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(ORDER_PAGE_SIZE_MAX).optional(),
});

const ORDER_COLUMNS = `id, order_number, status, funding_mode, shipping_payment_method,
  customer_name, customer_phone, shipping_address, shipping_cash_price, shipping_points_price,
  cash_total, points_total, expected_delivery_duration, created_at,
  confirmed_at, delivered_at, cancelled_at`;

const ITEM_COLUMNS = `id, product_id, variant_id, product_name_en, product_name_ar,
  variant_name_en, variant_name_ar, sku, quantity, product_payment_method,
  unit_cash_price, unit_points_price, line_cash_total, line_points_total, delivery_points_reward`;

/**
 * Customer order list. Authentication is enforced by the middleware; the query
 * runs as the caller (RLS) AND filters on the token-derived user id, so no
 * client-provided identity is ever trusted. Values come from the immutable
 * order snapshot, never from current catalog rows.
 */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data ?? {}))
  .handler(async ({ context, data }): Promise<OrderListPage> => {
    const { supabase, userId } = context;
    const { page, pageSize, from, to } = normalizePagination(data);

    const { data: rows, count, error } = await supabase
      .from("orders")
      .select(`${ORDER_COLUMNS}, order_items(id)`, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error("INTERNAL_ERROR");

    const orders = (rows ?? []).map((row) => {
      const { order_items: items, ...order } = row as typeof row & { order_items: { id: string }[] };
      return toOrderSummary(order, (items ?? []).length);
    });

    const total = count ?? orders.length;
    return { orders, page, pageSize: pageSize || ORDER_PAGE_SIZE, total, pageCount: pageCount(total, pageSize) };
  });

/**
 * Customer order detail. Ownership is enforced twice: the authenticated
 * Supabase client is bound by RLS (`user_id = auth.uid()`), and the query adds
 * an explicit `user_id` filter from the verified token. A fabricated or
 * someone else's order id yields ORDER_NOT_FOUND with no data leak.
 */
export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<OrderDetailView> => {
    const { supabase, userId } = context;

    const orderResult = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (orderResult.error) throw new Error("INTERNAL_ERROR");
    if (!orderResult.data) throw orderNotFound();

    const [itemsResult, ledgerResult] = await Promise.all([
      supabase
        .from("order_items")
        .select(ITEM_COLUMNS)
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("points_transactions")
        .select("type, delta")
        .eq("order_id", data.orderId)
        .eq("user_id", userId),
    ]);

    if (itemsResult.error || ledgerResult.error) throw new Error("INTERNAL_ERROR");

    return toOrderDetail(orderResult.data, itemsResult.data ?? [], ledgerResult.data ?? []);
  });
