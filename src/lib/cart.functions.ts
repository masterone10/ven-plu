import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CheckoutError,
  type CheckoutLine,
  isPointsShippingUnlocked,
  reviewLine,
} from "@/lib/checkout-rules";
import type { PaymentMethod } from "@/lib/points-rules";
import { primaryForVariant } from "@/lib/variant-media";

export type CartItemView = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  sku: string;
  productNameEn: string;
  productNameAr: string;
  variantNameEn: string;
  variantNameAr: string;
  imageUrl: string | null;
  quantity: number;
  paymentMethod: PaymentMethod;
  unitCashPrice: number;
  unitPointsPrice: number | null;
  pointsEnabled: boolean;
  stock: number;
  lineCashTotal: number;
  linePointsTotal: number;
  /** Deterministic stale-cart signal: the line no longer satisfies the rules. */
  issue: string | null;
};

export type CartView = {
  items: CartItemView[];
  pointsBalance: number;
  settings: {
    globalShippingPrice: number;
    shippingPointsPrice: number;
    freeShippingPointsThreshold: number;
    expectedDeliveryDuration: string;
  };
  pointsShippingUnlocked: boolean;
};

type CartRow = {
  id: string;
  quantity: number;
  product_payment_method: PaymentMethod;
  product_variants: {
    id: string;
    sku: string;
    name_en: string;
    name_ar: string;
    cash_price: number | null;
    points_price: number | null;
    stock: number;
    is_active: boolean;
    products: {
      id: string;
      slug: string;
      name_en: string;
      name_ar: string;
      cash_price: number;
      points_enabled: boolean;
      default_points_price: number | null;
      delivery_points_reward: number;
      is_active: boolean;
      product_images: {
        url: string;
        alt_en: string | null;
        alt_ar: string | null;
        is_primary: boolean;
        sort_order: number;
        variant_id: string | null;
      }[];
    };
  };
};

const CART_SELECT = `id, quantity, product_payment_method,
  product_variants!inner (
    id, sku, name_en, name_ar, cash_price, points_price, stock, is_active,
    products!inner (
      id, slug, name_en, name_ar, cash_price, points_enabled, default_points_price,
      delivery_points_reward, is_active,
      product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )
    )
  )`;

/** Reads the server-authoritative cart: prices, stock, and balance come from the database. */
export const getCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CartView> => {
    const { supabase, userId } = context;

    const [cartResult, balanceResult, settingsResult] = await Promise.all([
      supabase.from("carts").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("points_balances").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .from("store_settings")
        .select(
          "global_shipping_price, shipping_points_price, free_shipping_points_threshold, expected_delivery_duration",
        )
        .maybeSingle(),
    ]);

    if (cartResult.error) throw new Error(cartResult.error.message);
    if (balanceResult.error) throw new Error(balanceResult.error.message);
    if (settingsResult.error) throw new Error(settingsResult.error.message);

    const pointsBalance = balanceResult.data?.balance ?? 0;
    const settingsRow = settingsResult.data;
    const settings = {
      globalShippingPrice: Number(settingsRow?.global_shipping_price ?? 80),
      shippingPointsPrice: Number(settingsRow?.shipping_points_price ?? 400),
      freeShippingPointsThreshold: Number(settingsRow?.free_shipping_points_threshold ?? 0),
      expectedDeliveryDuration: settingsRow?.expected_delivery_duration ?? "2-5 days",
    };

    let items: CartItemView[] = [];
    if (cartResult.data) {
      const { data, error } = await supabase
        .from("cart_items")
        .select(CART_SELECT)
        .eq("cart_id", cartResult.data.id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      items = ((data ?? []) as unknown as CartRow[]).map(toCartItemView);
    }

    return {
      items,
      pointsBalance,
      settings,
      pointsShippingUnlocked: isPointsShippingUnlocked({
        balance: pointsBalance,
        shippingPointsPrice: settings.shippingPointsPrice,
      }),
    };
  });

function toCartItemView(row: CartRow): CartItemView {
  const variant = row.product_variants;
  const product = variant.products;
  // Cart rows show the image of the exact variant that was chosen, falling
  // back to the shared product image only when the variant has none.
  const image = primaryForVariant(
    (product.product_images ?? []).map((row) => ({
      url: row.url,
      altEn: row.alt_en,
      altAr: row.alt_ar,
      variantId: row.variant_id,
      isPrimary: row.is_primary,
      sortOrder: row.sort_order,
    })),
    variant.id,
  );

  const line: CheckoutLine = {
    sku: variant.sku,
    quantity: row.quantity,
    paymentMethod: row.product_payment_method,
    productActive: product.is_active,
    variantActive: variant.is_active,
    stock: variant.stock,
    productCashPrice: Number(product.cash_price),
    variantCashPrice: variant.cash_price === null ? null : Number(variant.cash_price),
    pointsEnabled: product.points_enabled,
    defaultPointsPrice: product.default_points_price,
    variantPointsPrice: variant.points_price,
    deliveryPointsReward: product.delivery_points_reward,
  };

  let issue: string | null = null;
  let unitCashPrice = Number(variant.cash_price ?? product.cash_price);
  let lineCashTotal = 0;
  let linePointsTotal = 0;
  let unitPointsPrice: number | null = variant.points_price ?? product.default_points_price;

  try {
    const totals = reviewLine(line);
    unitCashPrice = totals.unitCashPrice || unitCashPrice;
    lineCashTotal = totals.lineCashTotal;
    linePointsTotal = totals.linePointsTotal;
    if (totals.paymentMethod === "POINTS") unitPointsPrice = totals.unitPointsPrice;
  } catch (error) {
    issue = error instanceof CheckoutError ? error.code : "INTERNAL_ERROR";
  }

  return {
    id: row.id,
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    sku: variant.sku,
    productNameEn: product.name_en,
    productNameAr: product.name_ar,
    variantNameEn: variant.name_en,
    variantNameAr: variant.name_ar,
    imageUrl: image?.url ?? null,
    quantity: row.quantity,
    paymentMethod: row.product_payment_method,
    unitCashPrice,
    unitPointsPrice: product.points_enabled ? unitPointsPrice : null,
    pointsEnabled: product.points_enabled,
    stock: variant.stock,
    lineCashTotal,
    linePointsTotal,
    issue,
  };
}

async function ensureCart(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const existing = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id as string;

  const created = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id as string;
}

const addSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  paymentMethod: z.enum(["CASH", "POINTS"]),
});

/** Adds a variant to the cart. Only ids and quantities are accepted — never prices. */
export const addCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const variant = await supabase
      .from("product_variants")
      .select("id, stock, is_active, products!inner ( is_active, points_enabled )")
      .eq("id", data.variantId)
      .maybeSingle();
    if (variant.error) throw new Error(variant.error.message);
    if (!variant.data) throw new Error("VARIANT_NOT_FOUND");

    const product = variant.data.products as unknown as {
      is_active: boolean;
      points_enabled: boolean;
    };
    if (!product.is_active) throw new Error("PRODUCT_INACTIVE");
    if (!variant.data.is_active) throw new Error("VARIANT_INACTIVE");
    if (data.paymentMethod === "POINTS" && !product.points_enabled) {
      throw new Error("POINTS_NOT_ENABLED");
    }

    const cartId = await ensureCart(supabase as never, userId);

    const existing = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", data.variantId)
      .eq("product_payment_method", data.paymentMethod)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    const nextQuantity = Math.min(99, (existing.data?.quantity ?? 0) + data.quantity);
    if (nextQuantity > variant.data.stock) throw new Error("INSUFFICIENT_STOCK");

    if (existing.data) {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: nextQuantity })
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("cart_items").insert({
        cart_id: cartId,
        variant_id: data.variantId,
        quantity: data.quantity,
        product_payment_method: data.paymentMethod,
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true as const };
  });

const updateSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).optional(),
  paymentMethod: z.enum(["CASH", "POINTS"]).optional(),
});

/** Updates quantity and/or the item's payment method. Ownership enforced by RLS. */
export const updateCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const item = await supabase
      .from("cart_items")
      .select("id, variant_id, product_variants!inner ( stock, products!inner ( points_enabled ) )")
      .eq("id", data.itemId)
      .maybeSingle();
    if (item.error) throw new Error(item.error.message);
    if (!item.data) throw new Error("FORBIDDEN");

    const variant = item.data.product_variants as unknown as {
      stock: number;
      products: { points_enabled: boolean };
    };
    if (data.quantity !== undefined && data.quantity > variant.stock) {
      throw new Error("INSUFFICIENT_STOCK");
    }
    if (data.paymentMethod === "POINTS" && !variant.products.points_enabled) {
      throw new Error("POINTS_NOT_ENABLED");
    }

    const patch: { quantity?: number; product_payment_method?: PaymentMethod } = {};
    if (data.quantity !== undefined) patch.quantity = data.quantity;
    if (data.paymentMethod !== undefined) patch.product_payment_method = data.paymentMethod;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabase.from("cart_items").update(patch).eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Removes one cart line. */
export const removeCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("cart_items").delete().eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Sets every cart line to one payment method, so funding stays unmixed. */
export const setCartPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ paymentMethod: z.enum(["CASH", "POINTS"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const cart = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
    if (cart.error) throw new Error(cart.error.message);
    if (!cart.data) return { ok: true as const };

    const { error } = await supabase
      .from("cart_items")
      .update({ product_payment_method: data.paymentMethod })
      .eq("cart_id", cart.data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
