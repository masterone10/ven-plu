import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { primaryForVariant, sortMedia, type MediaImage } from "@/lib/variant-media";

export type CatalogVariant = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  cashPrice: number;
  pointsPrice: number | null;
  stock: number;
};

export type PublicCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  categoryId: string | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  cashPrice: number;
  pointsEnabled: boolean;
  defaultPointsPrice: number | null;
  deliveryPointsReward: number;
  /** Persisted media rows; variant-scoped rows carry a `variantId`. */
  images: MediaImage[];
  imageUrl: string | null;
  imageAltEn: string | null;
  imageAltAr: string | null;
  variants: CatalogVariant[];
};

export type CatalogPayload = {
  products: CatalogProduct[];
  categories: PublicCategory[];
};

/**
 * Public catalog read used by the storefront and home page.
 * Runs through the publishable key against the narrow public SELECT policies.
 */
export const listCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogProduct[]> => {
    const supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          `id, slug, category_id, name_en, name_ar, description_en, description_ar, cash_price,
           points_enabled, default_points_price, delivery_points_reward,
           product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
           product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
        )
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("categories")
        .select("id, slug, name_en, name_ar, is_active")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (productsResult.error) throw new Error(productsResult.error.message);

    const categoriesMap = new Map<string, PublicCategory>(
      (categoriesResult.data ?? []).map((cat) => [
        cat.id,
        { id: cat.id, slug: cat.slug, nameEn: cat.name_en, nameAr: cat.name_ar },
      ]),
    );

    return (productsResult.data ?? []).map((product) => {
      const images = sortMedia(
        (product.product_images ?? []).map((image) => ({
          url: image.url,
          altEn: image.alt_en,
          altAr: image.alt_ar,
          variantId: image.variant_id,
          isPrimary: image.is_primary,
          sortOrder: image.sort_order,
        })),
      );
      const variants = (product.product_variants ?? [])
        .filter((variant) => variant.is_active)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          nameEn: variant.name_en,
          nameAr: variant.name_ar,
          cashPrice: Number(variant.cash_price ?? product.cash_price),
          pointsPrice: variant.points_price ?? product.default_points_price,
          stock: variant.stock,
        }));
      const primary = primaryForVariant(images, variants[0]?.id ?? null);
      const cat = product.category_id ? categoriesMap.get(product.category_id) : null;

      return {
        id: product.id,
        slug: product.slug,
        categoryId: product.category_id,
        categoryNameEn: cat?.nameEn ?? null,
        categoryNameAr: cat?.nameAr ?? null,
        nameEn: product.name_en,
        nameAr: product.name_ar,
        descriptionEn: product.description_en,
        descriptionAr: product.description_ar,
        cashPrice: Number(product.cash_price),
        pointsEnabled: product.points_enabled,
        defaultPointsPrice: product.default_points_price,
        deliveryPointsReward: product.delivery_points_reward,
        images,
        imageUrl: primary?.url ?? null,
        imageAltEn: primary?.altEn ?? null,
        imageAltAr: primary?.altAr ?? null,
        variants,
      };
    });
  },
);

/**
 * Public catalog payload including both active categories and active products.
 */
export const getCatalogPayload = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogPayload> => {
    const supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          `id, slug, category_id, name_en, name_ar, description_en, description_ar, cash_price,
           points_enabled, default_points_price, delivery_points_reward,
           product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
           product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
        )
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("categories")
        .select("id, slug, name_en, name_ar, is_active")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (productsResult.error) throw new Error(productsResult.error.message);

    const categories: PublicCategory[] = (categoriesResult.data ?? []).map((cat) => ({
      id: cat.id,
      slug: cat.slug,
      nameEn: cat.name_en,
      nameAr: cat.name_ar,
    }));

    const categoriesMap = new Map<string, PublicCategory>(categories.map((c) => [c.id, c]));

    const products: CatalogProduct[] = (productsResult.data ?? []).map((product) => {
      const images = sortMedia(
        (product.product_images ?? []).map((image) => ({
          url: image.url,
          altEn: image.alt_en,
          altAr: image.alt_ar,
          variantId: image.variant_id,
          isPrimary: image.is_primary,
          sortOrder: image.sort_order,
        })),
      );
      const variants = (product.product_variants ?? [])
        .filter((variant) => variant.is_active)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          nameEn: variant.name_en,
          nameAr: variant.name_ar,
          cashPrice: Number(variant.cash_price ?? product.cash_price),
          pointsPrice: variant.points_price ?? product.default_points_price,
          stock: variant.stock,
        }));
      const primary = primaryForVariant(images, variants[0]?.id ?? null);
      const cat = product.category_id ? categoriesMap.get(product.category_id) : null;

      return {
        id: product.id,
        slug: product.slug,
        categoryId: product.category_id,
        categoryNameEn: cat?.nameEn ?? null,
        categoryNameAr: cat?.nameAr ?? null,
        nameEn: product.name_en,
        nameAr: product.name_ar,
        descriptionEn: product.description_en,
        descriptionAr: product.description_ar,
        cashPrice: Number(product.cash_price),
        pointsEnabled: product.points_enabled,
        defaultPointsPrice: product.default_points_price,
        deliveryPointsReward: product.delivery_points_reward,
        images,
        imageUrl: primary?.url ?? null,
        imageAltEn: primary?.altEn ?? null,
        imageAltAr: primary?.altAr ?? null,
        variants,
      };
    });

    return { products, categories };
  },
);

/**
 * Fetch a single product by slug or id for the standalone Product Details page.
 */
export const getProductBySlugOrId = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slugOrId: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<CatalogProduct | null> => {
    const supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const raw = data.slugOrId.trim();
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

    const query = supabase.from("products").select(
      `id, slug, category_id, name_en, name_ar, description_en, description_ar, cash_price,
         points_enabled, default_points_price, delivery_points_reward, is_active,
         product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
         product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
    );

    let result = isUuid
      ? await query.eq("id", raw).maybeSingle()
      : await query.eq("slug", decoded).maybeSingle();

    // If not found by decoded slug, try raw slug or ID
    if (!result.data && !isUuid) {
      const fallbackQuery = supabase.from("products").select(
        `id, slug, category_id, name_en, name_ar, description_en, description_ar, cash_price,
           points_enabled, default_points_price, delivery_points_reward, is_active,
           product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
           product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
      );
      const fallbackRes = await fallbackQuery.eq("slug", raw).maybeSingle();
      if (fallbackRes.data) {
        result = fallbackRes;
      }
    }

    if (result.error) throw new Error(result.error.message);
    if (!result.data) return null;

    const product = result.data;

    let categoryNameEn: string | null = null;
    let categoryNameAr: string | null = null;
    if (product.category_id) {
      const catRes = await supabase
        .from("categories")
        .select("name_en, name_ar")
        .eq("id", product.category_id)
        .maybeSingle();
      if (catRes.data) {
        categoryNameEn = catRes.data.name_en;
        categoryNameAr = catRes.data.name_ar;
      }
    }

    const images = sortMedia(
      (product.product_images ?? []).map((image) => ({
        url: image.url,
        altEn: image.alt_en,
        altAr: image.alt_ar,
        variantId: image.variant_id,
        isPrimary: image.is_primary,
        sortOrder: image.sort_order,
      })),
    );

    const variants = (product.product_variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        nameEn: variant.name_en,
        nameAr: variant.name_ar,
        cashPrice: Number(variant.cash_price ?? product.cash_price),
        pointsPrice: variant.points_price ?? product.default_points_price,
        stock: variant.stock,
      }));

    const primary = primaryForVariant(images, variants[0]?.id ?? null);

    return {
      id: product.id,
      slug: product.slug,
      categoryId: product.category_id,
      categoryNameEn,
      categoryNameAr,
      nameEn: product.name_en,
      nameAr: product.name_ar,
      descriptionEn: product.description_en,
      descriptionAr: product.description_ar,
      cashPrice: Number(product.cash_price),
      pointsEnabled: product.points_enabled,
      defaultPointsPrice: product.default_points_price,
      deliveryPointsReward: product.delivery_points_reward,
      images,
      imageUrl: primary?.url ?? null,
      imageAltEn: primary?.altEn ?? null,
      imageAltAr: primary?.altAr ?? null,
      variants,
    };
  });
