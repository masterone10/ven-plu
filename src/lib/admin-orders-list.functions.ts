import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AdminProductError, forbidden } from "@/lib/admin-product-rules";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RawAddress = {
  governorate?: string;
  city?: string;
  street?: string;
  notes?: string | null;
  secondaryPhone?: string | null;
  whatsApp?: string | null;
};

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  userId: string | null;
  status: string;
  fundingMode: string;
  shippingPaymentMethod: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: {
    governorate: string;
    city: string;
    street: string;
    notes?: string | null;
    secondaryPhone?: string | null;
    whatsApp?: string | null;
  };
  shippingCashPrice: number;
  shippingPointsPrice: number;
  cashTotal: number;
  pointsTotal: number;
  expectedDeliveryDuration: string;
  itemCount: number;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  purchaseRewardGranted: boolean;
  referralRewardGranted: boolean;
  notes?: string | null;
};

export type AdminOrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  productNameEn: string;
  productNameAr: string;
  variantNameEn: string;
  variantNameAr: string;
  sku: string;
  quantity: number;
  productPaymentMethod: "CASH" | "POINTS";
  unitCashPrice: number;
  unitPointsPrice: number | null;
  lineCashTotal: number;
  linePointsTotal: number;
  deliveryPointsReward: number;
};

export type AdminOrderDetail = AdminOrderRow & {
  items: AdminOrderItem[];
  pointsTransactions: Array<{
    id: string;
    type: string;
    delta: number;
    note: string | null;
    createdAt: string;
  }>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AuthedContext = { supabase: any; userId: string };

async function assertAdmin(context: AuthedContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new AdminProductError("INTERNAL_ERROR");
  if (data !== true) throw forbidden();
}

const listOrdersSchema = z.object({
  status: z.string().optional(),
  fundingMode: z.string().optional(),
  shippingPaymentMethod: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

export const listAllAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listOrdersSchema.parse(data ?? {}))
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      orders: AdminOrderRow[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }> => {
      await assertAdmin(context);
      const { supabase } = context;

      let query = supabase.from("orders").select(
        `id, order_number, user_id, status, funding_mode, shipping_payment_method,
         customer_name, customer_phone, shipping_address, shipping_cash_price,
         shipping_points_price, cash_total, points_total, expected_delivery_duration,
         created_at, confirmed_at, delivered_at, cancelled_at, purchase_reward_granted,
         referral_reward_granted, order_items(id)`,
        { count: "exact" },
      );

      if (data.status && data.status !== "ALL") {
        query = query.eq("status", data.status as any);
      }

      if (data.fundingMode && data.fundingMode !== "ALL") {
        query = query.eq("funding_mode", data.fundingMode as any);
      }

      if (data.shippingPaymentMethod && data.shippingPaymentMethod !== "ALL") {
        query = query.eq("shipping_payment_method", data.shippingPaymentMethod as any);
      }

      if (data.search && data.search.trim() !== "") {
        const term = data.search.trim();
        query = query.or(
          `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
        );
      }

      const from = (data.page - 1) * data.pageSize;
      const to = from + data.pageSize - 1;

      const {
        data: rows,
        count,
        error,
      } = await query.order("created_at", { ascending: false }).range(from, to);

      if (error) {
        console.error("Failed to list admin orders:", error);
        throw new AdminProductError("INTERNAL_ERROR");
      }

      const orders: AdminOrderRow[] = (rows ?? []).map((r: any) => {
        const items = r.order_items ?? [];
        const addr = (r.shipping_address as RawAddress | null) ?? {};
        return {
          id: r.id,
          orderNumber: r.order_number,
          userId: r.user_id,
          status: r.status,
          fundingMode: r.funding_mode,
          shippingPaymentMethod: r.shipping_payment_method,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          shippingAddress: {
            governorate: addr.governorate ?? "",
            city: addr.city ?? "",
            street: addr.street ?? "",
            notes: addr.notes ?? null,
            secondaryPhone: addr.secondaryPhone ?? null,
            whatsApp: addr.whatsApp ?? null,
          },
          shippingCashPrice: Number(r.shipping_cash_price ?? 0),
          shippingPointsPrice: Number(r.shipping_points_price ?? 0),
          cashTotal: Number(r.cash_total ?? 0),
          pointsTotal: Number(r.points_total ?? 0),
          expectedDeliveryDuration: r.expected_delivery_duration ?? "",
          itemCount: items.length,
          createdAt: r.created_at,
          confirmedAt: r.confirmed_at,
          deliveredAt: r.delivered_at,
          cancelledAt: r.cancelled_at,
          purchaseRewardGranted: Boolean(r.purchase_reward_granted),
          referralRewardGranted: Boolean(r.referral_reward_granted),
          notes: addr.notes ?? null,
        };
      });

      const total = count ?? orders.length;
      return {
        orders,
        total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: Math.max(1, Math.ceil(total / data.pageSize)),
      };
    },
  );

export const getAdminOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AdminOrderDetail> => {
    await assertAdmin(context);
    const { supabase } = context;

    const [orderRes, itemsRes, txRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", data.orderId).single(),
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("points_transactions")
        .select("id, type, delta, note, created_at")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false }),
    ]);

    if (orderRes.error || !orderRes.data) throw new AdminProductError("INTERNAL_ERROR");

    const r = orderRes.data;
    const items: AdminOrderItem[] = (itemsRes.data ?? []).map((it: any) => ({
      id: it.id,
      productId: it.product_id,
      variantId: it.variant_id,
      productNameEn: it.product_name_en,
      productNameAr: it.product_name_ar,
      variantNameEn: it.variant_name_en,
      variantNameAr: it.variant_name_ar,
      sku: it.sku,
      quantity: it.quantity,
      productPaymentMethod: it.product_payment_method,
      unitCashPrice: Number(it.unit_cash_price),
      unitPointsPrice: it.unit_points_price != null ? Number(it.unit_points_price) : null,
      lineCashTotal: Number(it.line_cash_total),
      linePointsTotal: Number(it.line_points_total),
      deliveryPointsReward: Number(it.delivery_points_reward ?? 0),
    }));

    const addr = (r.shipping_address as RawAddress | null) ?? {};

    return {
      id: r.id,
      orderNumber: r.order_number,
      userId: r.user_id,
      status: r.status,
      fundingMode: r.funding_mode,
      shippingPaymentMethod: r.shipping_payment_method,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      shippingAddress: {
        governorate: addr.governorate ?? "",
        city: addr.city ?? "",
        street: addr.street ?? "",
        notes: addr.notes ?? null,
        secondaryPhone: addr.secondaryPhone ?? null,
        whatsApp: addr.whatsApp ?? null,
      },
      shippingCashPrice: Number(r.shipping_cash_price ?? 0),
      shippingPointsPrice: Number(r.shipping_points_price ?? 0),
      cashTotal: Number(r.cash_total ?? 0),
      pointsTotal: Number(r.points_total ?? 0),
      expectedDeliveryDuration: r.expected_delivery_duration ?? "",
      itemCount: items.length,
      createdAt: r.created_at,
      confirmedAt: r.confirmed_at,
      deliveredAt: r.delivered_at,
      cancelledAt: r.cancelled_at,
      purchaseRewardGranted: Boolean(r.purchase_reward_granted),
      referralRewardGranted: Boolean(r.referral_reward_granted),
      notes: addr.notes ?? null,
      items,
      pointsTransactions: (txRes.data ?? []).map((t: any) => ({
        id: t.id,
        type: t.type,
        delta: t.delta,
        note: t.note,
        createdAt: t.created_at,
      })),
    };
  });

const validStatuses = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const updateAdminOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        newStatus: z.enum(validStatuses),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { orderId, newStatus } = data;

    const updates: {
      status: (typeof validStatuses)[number];
      confirmed_at?: string;
      delivered_at?: string;
      cancelled_at?: string;
    } = { status: newStatus };
    if (newStatus === "CONFIRMED") updates.confirmed_at = new Date().toISOString();
    if (newStatus === "DELIVERED") updates.delivered_at = new Date().toISOString();
    if (newStatus === "CANCELLED") updates.cancelled_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("orders")
      .update(updates as any)
      .eq("id", orderId);
    if (error) throw new AdminProductError("INTERNAL_ERROR");

    // If transitioned to DELIVERED, apply delivery and referral rewards automatically!
    if (newStatus === "DELIVERED") {
      try {
        await supabaseAdmin.rpc("apply_delivery_rewards", { _order_id: orderId });
      } catch (rewardErr) {
        console.error("Failed to auto-apply delivery rewards:", rewardErr);
      }
    }

    return { ok: true, status: newStatus };
  });

export const cancelAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { userId } = context;

    const { data: res, error } = await supabaseAdmin.rpc("cancel_order_with_compensation", {
      _order_id: data.orderId,
      _actor_id: userId,
    });

    if (error) {
      throw new Error(error.message || "Failed to cancel order");
    }

    const row = Array.isArray(res) ? res[0] : res;
    return { ok: true, refundedPoints: row?.refunded_points ?? 0 };
  });

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const exportAdminOrdersCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.string().optional(),
        fundingMode: z.string().optional(),
        shippingPaymentMethod: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ csvData: string; fileName: string }> => {
    await assertAdmin(context);

    let query = supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_number,
        created_at,
        status,
        funding_mode,
        shipping_payment_method,
        customer_name,
        customer_phone,
        shipping_address,
        shipping_cash_price,
        shipping_points_price,
        cash_total,
        points_total,
        expected_delivery_duration,
        confirmed_at,
        delivered_at,
        cancelled_at,
        order_items (
          id,
          sku,
          product_name_ar,
          product_name_en,
          variant_name_ar,
          variant_name_en,
          quantity,
          product_payment_method,
          unit_cash_price,
          unit_points_price,
          line_cash_total,
          line_points_total,
          delivery_points_reward
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "ALL") {
      query = query.eq(
        "status",
        data.status as
          | "PENDING_CONFIRMATION"
          | "CONFIRMED"
          | "PROCESSING"
          | "SHIPPED"
          | "DELIVERED"
          | "CANCELLED",
      );
    }
    if (data.fundingMode && data.fundingMode !== "ALL") {
      query = query.eq("funding_mode", data.fundingMode as "CASH_ONLY" | "POINTS_ONLY" | "MIXED");
    }
    if (data.shippingPaymentMethod && data.shippingPaymentMethod !== "ALL") {
      query = query.eq("shipping_payment_method", data.shippingPaymentMethod as "CASH" | "POINTS");
    }
    if (data.search && data.search.trim()) {
      const q = data.search.trim();
      query = query.or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`,
      );
    }

    const { data: orders, error } = await query;
    if (error) {
      console.error("Failed to fetch orders for export:", error);
      throw new AdminProductError("INTERNAL_ERROR");
    }

    const headers = [
      "Order Number (رقم الطلب)",
      "Created At (تاريخ الطلب)",
      "Status (حالة الطلب)",
      "Customer Name (اسم العميل)",
      "Phone (رقم الهاتف)",
      "Secondary Phone (رقم هاتف ثانٍ)",
      "Address (العنوان)",
      "Notes (ملاحظات التوصيل)",
      "Funding Mode (طريقة التمويل)",
      "Shipping Payment (دفع الشحن)",
      "Cash Total EGP (إجمالي الكاش)",
      "Points Total (إجمالي النقاط)",
      "Shipping Cash EGP (شحن كاش)",
      "Shipping Points (شحن نقاط)",
      "Item SKU (كود الصنف)",
      "Product Name (اسم المنتج)",
      "Variant Name (المتغير)",
      "Quantity (الكمية)",
      "Item Payment (طريقة دفع الصنف)",
      "Unit Cash EGP (سعر الوحدة كاش)",
      "Unit Points (سعر الوحدة نقاط)",
      "Line Cash EGP (إجمالي الصنف كاش)",
      "Line Points (إجمالي الصنف نقاط)",
      "Delivery Reward Points (مكافأة التسليم)",
    ];

    const rows: string[] = [headers.join(",")];

    for (const ord of (orders as any[]) ?? []) {
      const addr = (ord.shipping_address as any) || {};
      const fullAddress = [addr.address, addr.street, addr.city, addr.governorate]
        .filter(Boolean)
        .join(" - ");
      const secondaryPhone = addr.secondaryPhone || addr.secondary_phone || "";
      const notes = addr.notes || "";
      const items = ord.order_items || [];

      if (items.length === 0) {
        rows.push(
          [
            escapeCsv(ord.order_number),
            escapeCsv(ord.created_at),
            escapeCsv(ord.status),
            escapeCsv(ord.customer_name),
            escapeCsv(ord.customer_phone),
            escapeCsv(secondaryPhone),
            escapeCsv(fullAddress),
            escapeCsv(notes),
            escapeCsv(ord.funding_mode),
            escapeCsv(ord.shipping_payment_method),
            escapeCsv(ord.cash_total),
            escapeCsv(ord.points_total),
            escapeCsv(ord.shipping_cash_price),
            escapeCsv(ord.shipping_points_price),
            escapeCsv(""),
            escapeCsv(""),
            escapeCsv(""),
            escapeCsv("0"),
            escapeCsv(""),
            escapeCsv("0"),
            escapeCsv("0"),
            escapeCsv("0"),
            escapeCsv("0"),
            escapeCsv("0"),
          ].join(","),
        );
      } else {
        for (const item of items) {
          rows.push(
            [
              escapeCsv(ord.order_number),
              escapeCsv(ord.created_at),
              escapeCsv(ord.status),
              escapeCsv(ord.customer_name),
              escapeCsv(ord.customer_phone),
              escapeCsv(secondaryPhone),
              escapeCsv(fullAddress),
              escapeCsv(notes),
              escapeCsv(ord.funding_mode),
              escapeCsv(ord.shipping_payment_method),
              escapeCsv(ord.cash_total),
              escapeCsv(ord.points_total),
              escapeCsv(ord.shipping_cash_price),
              escapeCsv(ord.shipping_points_price),
              escapeCsv(item.sku),
              escapeCsv(item.product_name_ar || item.product_name_en),
              escapeCsv(item.variant_name_ar || item.variant_name_en),
              escapeCsv(item.quantity),
              escapeCsv(item.product_payment_method),
              escapeCsv(item.unit_cash_price),
              escapeCsv(item.unit_points_price),
              escapeCsv(item.line_cash_total),
              escapeCsv(item.line_points_total),
              escapeCsv(item.delivery_points_reward),
            ].join(","),
          );
        }
      }
    }

    // Include UTF-8 BOM for Arabic Excel compatibility
    const csvContent = "\uFEFF" + rows.join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10);

    return {
      csvData: csvContent,
      fileName: `ven_plus_orders_${dateStr}.csv`,
    };
  });
