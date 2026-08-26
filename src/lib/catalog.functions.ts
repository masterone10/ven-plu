import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
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

export type CatalogProduct = {
  id: string;
  slug: string;
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

/**
 * Public catalog read used by the storefront so items can be put in the cart.
 * Runs through the publishable key against the narrow public SELECT policies.
 */
export const listCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogProduct[]> => {
    const supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data, error } = await supabase
      .from("products")
      .select(
        `id, slug, name_en, name_ar, description_en, description_ar, cash_price,
         points_enabled, default_points_price, delivery_points_reward,
         product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
         product_images ( url, alt_en, alt_ar, is_primary, sort_order, variant_id )`,
      )
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((product) => {
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

