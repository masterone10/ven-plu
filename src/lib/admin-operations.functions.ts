import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { AdminProductError, forbidden } from "@/lib/admin-product-rules";
import {
  ORDER_STATUSES,
  type OrderStatus,
  type OrderSummaryView,
  type OrderDetailView,
  toOrderSummary,
  toOrderDetail,
  normalizePagination,
  pageCount,
  ORDER_PAGE_SIZE,
} from "@/lib/orders-rules";

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

/** Dashboard metrics for admin overview */
export const getAdminDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const [
      productsRes,
      activeProductsRes,
      variantsRes,
      ordersRes,
      pendingOrdersRes,
      deliveredOrdersRes,
      categoriesRes,
    ] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("product_variants").select("id, stock, is_active"),
      supabase.from("orders").select("id, cash_total, points_total, status"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING_CONFIRMATION"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "DELIVERED"),
      supabase.from("categories").select("id", { count: "exact", head: true }),
    ]);

    const totalProducts = productsRes.count ?? 0;
    const activeProducts = activeProductsRes.count ?? 0;
    const totalCategories = categoriesRes.count ?? 0;

    const variants = (variantsRes.data ?? []) as {
      id: string;
      stock: number;
      is_active: boolean;
    }[];
    const lowStockCount = variants.filter((v) => v.is_active && v.stock <= 5).length;
    const outOfStockCount = variants.filter((v) => v.is_active && v.stock === 0).length;

    const orders = (ordersRes.data ?? []) as {
      id: string;
      cash_total: number;
      points_total: number;
      status: string;
    }[];
    const totalOrders = orders.length;
    const pendingOrders = pendingOrdersRes.count ?? 0;
    const deliveredOrders = deliveredOrdersRes.count ?? 0;

    const totalCashRevenue = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.cash_total || 0), 0);

    const totalPointsRedeemed = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.points_total || 0), 0);

    return {
      totalProducts,
      activeProducts,
      totalCategories,
      lowStockCount,
      outOfStockCount,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalCashRevenue,
      totalPointsRedeemed,
    };
  });

/** Category Management with auto-slug generation from Arabic */
const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  nameAr: z.string().trim().min(2, "Arabic name is required"),
  nameEn: z.string().trim().optional().default(""),
  slug: z.string().trim().optional().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export function generateCategorySlug(nameAr: string, nameEn?: string): string {
  if (nameEn && nameEn.trim()) {
    const enSlug = nameEn
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (enSlug) return enSlug;
  }
  // Generate clean slug from Arabic or timestamp
  const arClean = nameAr
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]/gu, "");
  return arClean || `cat-${Date.now()}`;
}

export const saveAdminCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => categoryInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const nameEn = data.nameEn || data.nameAr;
    const slug = data.slug || generateCategorySlug(data.nameAr, data.nameEn);

    const payload = {
      name_ar: data.nameAr,
      name_en: nameEn,
      slug,
      is_active: data.isActive,
      sort_order: data.sortOrder,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    } else {
      const { data: inserted, error } = await supabase
        .from("categories")
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    }
  });

export const toggleAdminCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ categoryId: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("categories")
      .update({ is_active: data.isActive, updated_at: new Date().toISOString() })
      .eq("id", data.categoryId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/** Inventory stock adjustment */
export const adjustVariantStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        variantId: z.string().uuid(),
        newStock: z.number().int().min(0),
        reason: z.string().optional().default("Manual adjustment"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: variant, error } = await supabase
      .from("product_variants")
      .update({ stock: data.newStock, updated_at: new Date().toISOString() })
      .eq("id", data.variantId)
      .select("id, sku, stock, product_id")
      .single();

    if (error) throw new Error(error.message);
    return variant;
  });

/** Admin Orders: list customer orders with rich filtering & search */
const adminOrderFilterSchema = z.object({
  query: z.string().optional().default(""),
  status: z.string().optional().default("ALL"),
  fundingMode: z.string().optional().default("ALL"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(50).optional().default(20),
});

const ORDER_COLUMNS = `id, order_number, status, funding_mode, shipping_payment_method,
  customer_name, customer_phone, shipping_address, shipping_cash_price, shipping_points_price,
  cash_total, points_total, expected_delivery_duration, created_at,
  confirmed_at, delivered_at, cancelled_at`;

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adminOrderFilterSchema.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;

    let query = supabase
      .from("orders")
      .select(
        `${ORDER_COLUMNS}, order_items(id, quantity, product_name_ar, variant_name_ar, line_cash_total, line_points_total)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.status !== "ALL") {
      query = query.eq("status", data.status as any);
    }
    if (data.fundingMode !== "ALL") {
      query = query.eq("funding_mode", data.fundingMode as any);
    }
    if (data.query.trim()) {
      const q = data.query.trim();
      query = query.or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`,
      );
    }

    const { page, pageSize, from, to } = normalizePagination({
      page: data.page,
      pageSize: data.pageSize,
    });
    query = query.range(from, to);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    const orders = (rows ?? []).map((row: any) => {
      const items = row.order_items ?? [];
      return {
        ...toOrderSummary(row, items.length),
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        shippingAddress: row.shipping_address,
        shippingCashPrice: row.shipping_cash_price,
        shippingPointsPrice: row.shipping_points_price,
        items,
      };
    });

    const total = count ?? orders.length;
    return {
      orders,
      page,
      pageSize,
      total,
      pageCount: pageCount(total, pageSize),
    };
  });

/** Admin order status update with authoritative lifecycle transitions */
export const updateAdminOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        newStatus: z.enum(ORDER_STATUSES),
        notes: z.string().optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch existing order snapshot and user
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, user_id, funding_mode, cash_total, points_total")
      .eq("id", data.orderId)
      .single();

    if (fetchErr || !order) throw new Error("Order not found");
    if (order.status === data.newStatus) return { success: true };

    const updatePayload: {
      status: (typeof ORDER_STATUSES)[number];
      updated_at: string;
      confirmed_at?: string;
      delivered_at?: string;
      cancelled_at?: string;
    } = {
      status: data.newStatus,
      updated_at: new Date().toISOString(),
    };

    if (data.newStatus === "CONFIRMED" && !order.status) {
      updatePayload.confirmed_at = new Date().toISOString();
    } else if (data.newStatus === "DELIVERED") {
      updatePayload.delivered_at = new Date().toISOString();
    } else if (data.newStatus === "CANCELLED") {
      updatePayload.cancelled_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", data.orderId);

    if (updateErr) throw new Error(updateErr.message);

    // If marked CANCELLED, restore variant stocks and refund points
    if (data.newStatus === "CANCELLED" && order.status !== "CANCELLED") {
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("variant_id, quantity, line_points_total, delivery_points_reward")
        .eq("order_id", data.orderId);

      if (items) {
        for (const item of items) {
          if (item.variant_id) {
            const { data: v } = await supabaseAdmin
              .from("product_variants")
              .select("stock")
              .eq("id", item.variant_id)
              .single();
            if (v) {
              await supabaseAdmin
                .from("product_variants")
                .update({ stock: v.stock + item.quantity })
                .eq("id", item.variant_id);
            }
          }
        }
      }

      // Check if order had redeemed points to refund
      if (order.points_total > 0 && order.user_id) {
        // Record refund ledger entry
        await (supabaseAdmin.from("points_transactions") as any).insert({
          user_id: order.user_id,
          order_id: data.orderId,
          delta: order.points_total,
          type: "REFUND_PRODUCT_REDEMPTION",
          note: "Admin cancelled order point refund",
          idempotency_key: `REFUND_PRODUCT_REDEMPTION:${data.orderId}`,
        });
      }
    }

    // If marked DELIVERED, award purchase reward points to customer
    if (data.newStatus === "DELIVERED" && order.status !== "DELIVERED") {
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("delivery_points_reward, quantity")
        .eq("order_id", data.orderId);

      const totalReward = (items ?? []).reduce(
        (acc, item) => acc + (item.delivery_points_reward || 0) * (item.quantity || 1),
        0,
      );

      if (totalReward > 0 && order.user_id) {
        await (supabaseAdmin.from("points_transactions") as any).insert({
          user_id: order.user_id,
          order_id: data.orderId,
          delta: totalReward,
          type: "EARN_PURCHASE",
          note: `Delivery points reward for order`,
          idempotency_key: `EARN_PURCHASE:${data.orderId}`,
        });
      }
    }

    return { success: true };
  });

/** Excel / CSV Export for Products (with UTF-8 BOM for Arabic support) */
export const exportProductsCSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: products } = await supabase
      .from("products")
      .select(
        `id, slug, name_en, name_ar, description_ar, cash_price, points_enabled,
         default_points_price, delivery_points_reward, is_active,
         product_variants ( sku, name_ar, name_en, cash_price, points_price, stock, is_active )`,
      )
      .order("created_at", { ascending: true });

    const headers = [
      "Product ID",
      "Slug",
      "Name (AR)",
      "Name (EN)",
      "Base Cash Price (EGP)",
      "Points Enabled",
      "Default Points Price",
      "Delivery Reward Points",
      "Variant SKU",
      "Variant Name (AR)",
      "Variant Cash Price",
      "Variant Points Price",
      "Stock",
      "Active",
    ];

    const rows: string[][] = [headers];

    for (const p of products ?? []) {
      const variants = p.product_variants ?? [];
      if (variants.length === 0) {
        rows.push([
          p.id,
          p.slug,
          `"${(p.name_ar || "").replace(/"/g, '""')}"`,
          `"${(p.name_en || "").replace(/"/g, '""')}"`,
          String(p.cash_price),
          p.points_enabled ? "YES" : "NO",
          String(p.default_points_price || 0),
          String(p.delivery_points_reward || 0),
          "",
          "",
          "",
          "",
          "0",
          p.is_active ? "YES" : "NO",
        ]);
      } else {
        for (const v of variants) {
          rows.push([
            p.id,
            p.slug,
            `"${(p.name_ar || "").replace(/"/g, '""')}"`,
            `"${(p.name_en || "").replace(/"/g, '""')}"`,
            String(p.cash_price),
            p.points_enabled ? "YES" : "NO",
            String(p.default_points_price || 0),
            String(p.delivery_points_reward || 0),
            v.sku,
            `"${(v.name_ar || "").replace(/"/g, '""')}"`,
            String(v.cash_price ?? p.cash_price),
            String(v.points_price ?? p.default_points_price ?? ""),
            String(v.stock),
            v.is_active && p.is_active ? "YES" : "NO",
          ]);
        }
      }
    }

    const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
    return {
      fileName: `ven_products_catalog_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    };
  });

/** Excel / CSV Export for Customer Orders (with UTF-8 BOM) */
export const exportOrdersCSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: orders } = await supabase
      .from("orders")
      .select(
        `id, order_number, status, funding_mode, customer_name, customer_phone,
         shipping_address, cash_total, points_total, shipping_cash_price, shipping_points_price,
         created_at, delivered_at,
         order_items ( product_name_ar, variant_name_ar, sku, quantity, line_cash_total, line_points_total )`,
      )
      .order("created_at", { ascending: false });

    const headers = [
      "Order Number",
      "Date",
      "Status",
      "Funding Mode",
      "Customer Name",
      "Customer Phone",
      "second phone",
      "Address",
      "Cash Total (EGP)",
      "Points Total",
      "Shipping Cash",
      "Shipping Points",
      "Items Breakdown",
      "العدد",
    ];

    const rows: string[][] = [headers];

    for (const o of orders ?? []) {
      const addr = (o.shipping_address ?? {}) as any;
      const addrStr = `"${[addr.address, addr.street, addr.city, addr.notes]
        .filter(Boolean)
        .join(" - ")
        .replace(/"/g, '""')}"`;
      const secPhone = addr.secondaryPhone || addr.secondPhone || "";
      const secPhoneStr = secPhone ? `'${secPhone}` : "";

      const itemsList = o.order_items ?? [];
      const totalPieces = itemsList.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0);

      const itemsStr = `"${itemsList
        .map((i: any) => {
          const vName = i.variant_name_ar || i.sku || "";
          return `${i.product_name_ar} (${vName}) x${i.quantity}`;
        })
        .join(" | ")
        .replace(/"/g, '""')}"`;

      rows.push([
        o.order_number,
        new Date(o.created_at).toLocaleDateString("en-GB"),
        o.status,
        o.funding_mode,
        `"${(o.customer_name || "").replace(/"/g, '""')}"`,
        `'${o.customer_phone}`,
        secPhoneStr,
        addrStr,
        String(o.cash_total),
        String(o.points_total),
        String(o.shipping_cash_price),
        String(o.shipping_points_price),
        itemsStr,
        String(totalPieces),
      ]);
    }

    const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
    return {
      fileName: `ven_orders_export_${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    };
  });

/** Official Order Excel Export (.xlsx) matching exact specification */
export const exportOrdersExcel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;
    const { exportOrdersToExcelBuffer } = await import("@/lib/order-excel");

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `id, order_number, status, funding_mode, customer_name, customer_phone,
         shipping_address, cash_total, points_total, shipping_cash_price, shipping_points_price,
         created_at, delivered_at,
         order_items ( id, product_id, variant_id, product_name_ar, product_name_en, variant_name_ar, variant_name_en, sku, quantity, unit_cash_price, unit_points_price, product_payment_method, line_cash_total, line_points_total )`,
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const formattedOrders = (orders ?? []).map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      createdAt: o.created_at,
      status: o.status,
      fundingMode: o.funding_mode,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      shippingAddress: o.shipping_address,
      cashTotal: Number(o.cash_total) || 0,
      pointsTotal: Number(o.points_total) || 0,
      shippingCashPrice: Number(o.shipping_cash_price) || 0,
      shippingPointsPrice: Number(o.shipping_points_price) || 0,
      items: (o.order_items ?? []).map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        variantId: i.variant_id,
        productNameAr: i.product_name_ar,
        productNameEn: i.product_name_en,
        variantNameAr: i.variant_name_ar,
        variantNameEn: i.variant_name_en,
        sku: i.sku,
        quantity: i.quantity,
        unitCashPrice: Number(i.unit_cash_price) || 0,
        unitPointsPrice: Number(i.unit_points_price) || 0,
        productPaymentMethod: i.product_payment_method || "CASH",
        lineCashTotal: Number(i.line_cash_total) || 0,
        linePointsTotal: Number(i.line_points_total) || 0,
      })),
    }));

    const buffer = exportOrdersToExcelBuffer(formattedOrders);
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      fileName: `ven_orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      base64,
    };
  });

/** Preview Excel Re-Import before executing */
export const previewOrdersExcelImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ base64: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;
    const { parseAndValidateOrderExcel } = await import("@/lib/order-excel");

    const buffer = Buffer.from(data.base64, "base64");

    // Fetch all existing orders snapshot for matching & validation
    const { data: orders, error } = await supabase.from("orders").select(
      `id, order_number, status, funding_mode, customer_name, customer_phone,
         shipping_address, cash_total, points_total, shipping_cash_price, shipping_points_price,
         order_items ( id, product_id, variant_id, product_name_ar, product_name_en, variant_name_ar, variant_name_en, sku, quantity, unit_cash_price, unit_points_price, product_payment_method )`,
    );

    if (error) throw new Error(error.message);

    const existingSnapshots = (orders ?? []).map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      status: o.status,
      fundingMode: o.funding_mode,
      cashTotal: Number(o.cash_total) || 0,
      pointsTotal: Number(o.points_total) || 0,
      shippingCashPrice: Number(o.shipping_cash_price) || 0,
      shippingPointsPrice: Number(o.shipping_points_price) || 0,
      shippingAddress: o.shipping_address,
      items: (o.order_items ?? []).map((i: any) => ({
        id: i.id,
        variantId: i.variant_id,
        productId: i.product_id,
        productNameAr: i.product_name_ar,
        productNameEn: i.product_name_en,
        variantNameAr: i.variant_name_ar,
        variantNameEn: i.variant_name_en,
        sku: i.sku,
        quantity: i.quantity,
        unitCashPrice: Number(i.unit_cash_price) || 0,
        unitPointsPrice: Number(i.unit_points_price) || 0,
        productPaymentMethod: i.product_payment_method || "CASH",
      })),
    }));

    const preview = parseAndValidateOrderExcel(buffer, existingSnapshots);
    return preview;
  });

/** Execute Confirmed Excel Re-Import Atomic Updates */
const excelImportExecuteSchema = z.object({
  changes: z.array(
    z.object({
      orderId: z.string().uuid(),
      orderNumber: z.string(),
      customerName: z.object({ old: z.string(), new: z.string() }).optional(),
      customerPhone: z.object({ old: z.string(), new: z.string() }).optional(),
      secondPhone: z.object({ old: z.string(), new: z.string() }).optional(),
      address: z.object({ old: z.string(), new: z.string() }).optional(),
      status: z.object({ old: z.enum(ORDER_STATUSES), new: z.enum(ORDER_STATUSES) }).optional(),
      itemChanges: z
        .array(
          z.object({
            itemId: z.string().optional(),
            variantSku: z.string(),
            name: z.string(),
            oldQty: z.number(),
            newQty: z.number(),
          }),
        )
        .optional(),
    }),
  ),
});

export const executeOrdersExcelImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => excelImportExecuteSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let updatedCount = 0;

    for (const change of data.changes) {
      // 1. Fetch current order state
      const { data: rawOrder, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select(
          "id, status, user_id, funding_mode, cash_total, points_total, shipping_cash_price, shipping_points_price, shipping_address",
        )
        .eq("id", change.orderId)
        .single();

      if (orderErr || !rawOrder) {
        throw new Error(`Order ${change.orderNumber} not found.`);
      }

      const order = rawOrder as {
        id: string;
        status: OrderStatus;
        user_id: string | null;
        funding_mode: "CASH_ONLY" | "POINTS_ONLY" | "MIXED";
        cash_total: number;
        points_total: number;
        shipping_cash_price: number;
        shipping_points_price: number;
        shipping_address: Record<string, unknown> | string | null;
      };

      const updateOrderPayload: Database["public"]["Tables"]["orders"]["Update"] = {
        updated_at: new Date().toISOString(),
      };

      if (change.customerName) {
        updateOrderPayload.customer_name = change.customerName.new;
      }
      if (change.customerPhone) {
        updateOrderPayload.customer_phone = change.customerPhone.new;
      }

      // Shipping address update
      if (change.address || change.secondPhone) {
        const currentAddr: Record<string, Json | undefined> =
          typeof order.shipping_address === "object" && order.shipping_address !== null
            ? { ...(order.shipping_address as Record<string, Json | undefined>) }
            : { address: String(order.shipping_address || "") };

        if (change.address) {
          currentAddr["address"] = change.address.new;
        }
        if (change.secondPhone) {
          currentAddr["secondaryPhone"] = change.secondPhone.new;
          currentAddr["secondPhone"] = change.secondPhone.new;
        }
        updateOrderPayload.shipping_address = currentAddr;
      }

      // Status update
      if (change.status) {
        updateOrderPayload.status = change.status.new;
        if (change.status.new === "CONFIRMED" && !order.status) {
          updateOrderPayload.confirmed_at = new Date().toISOString();
        } else if (change.status.new === "DELIVERED") {
          updateOrderPayload.delivered_at = new Date().toISOString();
        } else if (change.status.new === "CANCELLED") {
          updateOrderPayload.cancelled_at = new Date().toISOString();
        }
      }

      // Items and quantities update
      if (change.itemChanges && change.itemChanges.length > 0) {
        const { data: orderItems } = await supabaseAdmin
          .from("order_items")
          .select(
            "id, variant_id, sku, quantity, unit_cash_price, unit_points_price, product_payment_method",
          )
          .eq("order_id", change.orderId);

        let recalculatedItemsCash = 0;
        let recalculatedItemsPoints = 0;

        for (const item of orderItems ?? []) {
          const itemChange = change.itemChanges.find(
            (c) => (c.itemId && c.itemId === item.id) || c.variantSku === item.sku,
          );

          const newQty = itemChange !== undefined ? itemChange.newQty : item.quantity;
          const qtyDelta = item.quantity - newQty; // positive if decreased, negative if increased

          if (itemChange !== undefined && newQty !== item.quantity) {
            const lineCash =
              item.product_payment_method === "CASH"
                ? Number(item.unit_cash_price || 0) * newQty
                : 0;
            const linePoints =
              item.product_payment_method === "POINTS"
                ? Number(item.unit_points_price || 0) * newQty
                : 0;

            await supabaseAdmin
              .from("order_items")
              .update({
                quantity: newQty,
                line_cash_total: lineCash,
                line_points_total: linePoints,
              })
              .eq("id", item.id);

            // Update variant stock if order is active
            if (item.variant_id && order.status !== "CANCELLED" && qtyDelta !== 0) {
              const { data: v } = await supabaseAdmin
                .from("product_variants")
                .select("stock")
                .eq("id", item.variant_id)
                .single();

              if (v) {
                await supabaseAdmin
                  .from("product_variants")
                  .update({ stock: Math.max(0, v.stock + qtyDelta) })
                  .eq("id", item.variant_id);
              }
            }
          }

          if (item.product_payment_method === "CASH") {
            recalculatedItemsCash += Number(item.unit_cash_price || 0) * newQty;
          } else {
            recalculatedItemsPoints += Number(item.unit_points_price || 0) * newQty;
          }
        }

        const finalCashTotal = recalculatedItemsCash + Number(order.shipping_cash_price || 0);
        const finalPointsTotal = recalculatedItemsPoints + Number(order.shipping_points_price || 0);

        updateOrderPayload.cash_total = finalCashTotal;
        updateOrderPayload.points_total = finalPointsTotal;

        if (finalCashTotal > 0 && finalPointsTotal > 0) {
          updateOrderPayload.funding_mode = "MIXED";
        } else if (finalPointsTotal > 0) {
          updateOrderPayload.funding_mode = "POINTS_ONLY";
        } else {
          updateOrderPayload.funding_mode = "CASH_ONLY";
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update(updateOrderPayload)
        .eq("id", change.orderId);

      if (updateErr) {
        throw new Error(`Failed to update order ${change.orderNumber}: ${updateErr.message}`);
      }

      updatedCount++;
    }

    return {
      success: true,
      updatedOrdersCount: updatedCount,
    };
  });
