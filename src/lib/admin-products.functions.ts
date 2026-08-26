import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AdminProductError,
  assertCategoryAssignable,
  assertProductConsistency,
  forbidden,
  productInputSchema,
  toAdminProductRow,
  type AdminProductRow,
  type ProductInput,
} from "@/lib/admin-product-rules";
import { sortMedia, type MediaImage } from "@/lib/variant-media";

export type AdminCategory = { id: string; slug: string; nameEn: string; nameAr: string; isActive: boolean };

export type AdminProductDetail = ProductInput & {
  id: string;
  /** Variant ids by sku, so the UI can keep persisted rows stable. */
  variantIds: Record<string, string>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AuthedContext = { supabase: any; userId: string };


/**
 * Server-side authorization. The caller's role is read through the
 * security-definer `has_role` function with the caller's own RLS-bound client —
 * never from a request body, a client flag, or a profile column.
 */
async function assertAdmin(context: AuthedContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new AdminProductError("INTERNAL_ERROR");
  if (data !== true) throw forbidden();
}

/** Admin product list with the operational columns from §56. */
export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ products: AdminProductRow[]; categories: AdminCategory[] }> => {
    await assertAdmin(context);
    const { supabase } = context;

    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          `id, slug, name_en, name_ar, category_id, cash_price, points_enabled,
           default_points_price, is_active,
           product_variants ( id, points_price, stock, is_active ),
           product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
        )
        .order("created_at", { ascending: true }),
      supabase.from("categories").select("id, slug, name_en, name_ar, is_active").order("sort_order"),
    ]);

    if (productsResult.error || categoriesResult.error) throw new AdminProductError("INTERNAL_ERROR");

    const categories: AdminCategory[] = (categoriesResult.data ?? []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      nameEn: row.name_en,
      nameAr: row.name_ar,
      isActive: row.is_active,
    }));
    const byId = new Map(categories.map((row) => [row.id, row]));

    const products = (productsResult.data ?? []).map((row: any) => {
      const images = sortMedia(
        (row.product_images ?? []).map((image: any) => ({
          url: image.url,
          altEn: image.alt_en,
          altAr: image.alt_ar,
          variantId: image.variant_id,
          isPrimary: image.is_primary,
          sortOrder: image.sort_order,
        })) as MediaImage[],
      );
      const category = row.category_id ? byId.get(row.category_id) : null;
      return toAdminProductRow(
        row,
        row.product_variants ?? [],
        category ? { name_en: category.nameEn, name_ar: category.nameAr } : null,
        images[0]?.url ?? null,
      );
    });

    return { products, categories };
  });

/** Full editable product payload for the admin workspace. */
export const getAdminProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AdminProductDetail> => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("products")
      .select(
        `id, slug, category_id, name_en, name_ar, description_en, description_ar, cash_price,
         points_enabled, default_points_price, delivery_points_reward, is_active,
         product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
         product_images ( id, url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
      )
      .eq("id", data.productId)
      .maybeSingle();

    if (error) throw new AdminProductError("INTERNAL_ERROR");
    if (!row) throw new AdminProductError("PRODUCT_NOT_FOUND");

    const variants = (row.product_variants ?? []) as any[];
    const skuById = new Map<string, string>(variants.map((variant) => [variant.id, variant.sku]));
    const variantIds: Record<string, string> = {};
    for (const variant of variants) variantIds[variant.sku] = variant.id;

    return {
      id: row.id,
      slug: row.slug,
      categoryId: row.category_id,
      nameEn: row.name_en,
      nameAr: row.name_ar,
      descriptionEn: row.description_en,
      descriptionAr: row.description_ar,
      cashPrice: Number(row.cash_price),
      pointsEnabled: row.points_enabled,
      defaultPointsPrice: row.default_points_price,
      deliveryPointsReward: row.delivery_points_reward,
      isActive: row.is_active,
      variantIds,
      variants: variants
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          nameEn: variant.name_en,
          nameAr: variant.name_ar,
          cashPrice: variant.cash_price == null ? null : Number(variant.cash_price),
          pointsPrice: variant.points_price,
          stock: variant.stock,
          isActive: variant.is_active,
        })),
      media: ((row.product_images ?? []) as any[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((image) => ({
          id: image.id,
          url: image.url,
          altEn: image.alt_en,
          altAr: image.alt_ar,
          variantSku: image.variant_id ? (skuById.get(image.variant_id) ?? null) : null,
          sortOrder: image.sort_order,
          isPrimary: image.is_primary,
        })),
    };
  });

/**
 * Create or update a product with its variants and media in one authorized,
 * fully validated write. Every value is re-validated server-side; nothing is
 * trusted from the browser, including stock and prices.
 */
export const saveAdminProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => productInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<{ productId: string }> => {
    await assertAdmin(context);
    const { supabase } = context;

    assertProductConsistency(data);

    if (data.categoryId) {
      const category = await supabase
        .from("categories")
        .select("id, is_active")
        .eq("id", data.categoryId)
        .maybeSingle();
      if (category.error) throw new AdminProductError("INTERNAL_ERROR");
      if (!category.data) throw new AdminProductError("VALIDATION_ERROR", "unknown category");
      assertCategoryAssignable({ isActive: category.data.is_active });
    }

    const productPayload = {
      slug: data.slug,
      category_id: data.categoryId,
      name_en: data.nameEn,
      name_ar: data.nameAr,
      description_en: data.descriptionEn,
      description_ar: data.descriptionAr,
      cash_price: data.cashPrice,
      points_enabled: data.pointsEnabled,
      default_points_price: data.pointsEnabled ? data.defaultPointsPrice : null,
      delivery_points_reward: data.deliveryPointsReward,
      is_active: data.isActive,
    };

    let productId = data.id ?? "";
    if (productId) {
      const updated = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", productId)
        .select("id")
        .maybeSingle();
      if (updated.error) throw mapWriteError(updated.error, "slug");
      if (!updated.data) throw new AdminProductError("PRODUCT_NOT_FOUND");
    } else {
      const inserted = await supabase.from("products").insert(productPayload).select("id").single();
      if (inserted.error) throw mapWriteError(inserted.error, "slug");
      productId = inserted.data.id;
    }

    // ---- variants -------------------------------------------------------
    const existing = await supabase
      .from("product_variants")
      .select("id, sku")
      .eq("product_id", productId);
    if (existing.error) throw new AdminProductError("INTERNAL_ERROR");

    const existingBySku = new Map<string, string>(
      (existing.data ?? []).map((row: any) => [row.sku, row.id]),
    );
    const keptIds = new Set<string>();
    const variantIdBySku = new Map<string, string>();

    for (const variant of data.variants) {
      const payload = {
        product_id: productId,
        sku: variant.sku,
        name_en: variant.nameEn,
        name_ar: variant.nameAr,
        cash_price: variant.cashPrice,
        points_price: data.pointsEnabled ? variant.pointsPrice : null,
        stock: variant.stock,
        is_active: variant.isActive,
      };
      const currentId = variant.id ?? existingBySku.get(variant.sku);
      if (currentId) {
        const updated = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", currentId)
          .eq("product_id", productId)
          .select("id")
          .maybeSingle();
        if (updated.error) throw mapWriteError(updated.error, "sku");
        if (!updated.data) throw new AdminProductError("VALIDATION_ERROR", "unknown variant");
        keptIds.add(currentId);
        variantIdBySku.set(variant.sku, currentId);
      } else {
        const inserted = await supabase
          .from("product_variants")
          .insert(payload)
          .select("id")
          .single();
        if (inserted.error) throw mapWriteError(inserted.error, "sku");
        keptIds.add(inserted.data.id);
        variantIdBySku.set(variant.sku, inserted.data.id);
      }
    }

    // Variants removed in the editor are retired, never hard-deleted: order
    // snapshots and carts reference them and history must stay intact.
    const retired = (existing.data ?? [])
      .map((row: any) => row.id as string)
      .filter((id) => !keptIds.has(id));
    if (retired.length) {
      const deactivated = await supabase
        .from("product_variants")
        .update({ is_active: false })
        .in("id", retired);
      if (deactivated.error) throw new AdminProductError("INTERNAL_ERROR");
    }

    // ---- media ----------------------------------------------------------
    const wipe = await supabase.from("product_images").delete().eq("product_id", productId);
    if (wipe.error) throw new AdminProductError("INTERNAL_ERROR");

    if (data.media.length) {
      const rows = data.media.map((image, index) => ({
        product_id: productId,
        variant_id: image.variantSku ? (variantIdBySku.get(image.variantSku) ?? null) : null,
        url: image.url,
        alt_en: image.altEn,
        alt_ar: image.altAr,
        sort_order: image.sortOrder || index,
        is_primary: image.isPrimary,
      }));
      const insertedMedia = await supabase.from("product_images").insert(rows);
      if (insertedMedia.error) throw new AdminProductError("INTERNAL_ERROR");
    }

    return { productId };
  });

/** Publish / unpublish. Separate endpoint so the list can act without a full save. */
export const setAdminProductActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ productId: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ productId: string; isActive: boolean }> => {
    await assertAdmin(context);
    const updated = await context.supabase
      .from("products")
      .update({ is_active: data.isActive })
      .eq("id", data.productId)
      .select("id, is_active")
      .maybeSingle();
    if (updated.error) throw new AdminProductError("INTERNAL_ERROR");
    if (!updated.data) throw new AdminProductError("PRODUCT_NOT_FOUND");
    return { productId: updated.data.id, isActive: updated.data.is_active };
  });

function mapWriteError(error: { code?: string; message?: string }, field: "slug" | "sku") {
  if (error.code === "23505") {
    return new AdminProductError(field === "slug" ? "SLUG_TAKEN" : "SKU_TAKEN");
  }
  if (error.code === "42501") return forbidden();
  return new AdminProductError("INTERNAL_ERROR");
}
