/**
 * Server-only composition of the admin product download package.
 * Never imported by client code: it fetches image bytes and zips them.
 */
import { zipSync, strToU8 } from "fflate";
import {
  ProductPackageError,
  buildManifest,
  buildPackageDocuments,
  ensureImageExtension,
  packageFileName,
  packageSku,
  type PackageProduct,
} from "@/lib/product-package";


const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 40 * 1024 * 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function buildProductPackage(input: {
  supabase: any;
  productId: string;
  origin: string;
}): Promise<{
  fileName: string;
  contentBase64: string;
  byteLength: number;
  missing: { url: string; reason: string }[];
}> {
  const { data: row, error } = await input.supabase
    .from("products")
    .select(
      `id, slug, name_en, name_ar, description_en, description_ar, cash_price,
       points_enabled, default_points_price, delivery_points_reward, is_active,
       created_at, updated_at,
       categories ( slug ),
       product_variants ( id, sku, name_en, name_ar, cash_price, points_price, stock, is_active ),
       product_images ( url, alt_en, alt_ar, sort_order, is_primary, variant_id )`,
    )
    .eq("id", input.productId)
    .maybeSingle();

  if (error) throw new ProductPackageError("INTERNAL_ERROR");
  if (!row) throw new ProductPackageError("PRODUCT_NOT_FOUND");

  const variants = (row.product_variants ?? []) as any[];
  const skuById = new Map<string, string>(variants.map((variant) => [variant.id, variant.sku]));

  const product: PackageProduct = {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    descriptionEn: row.description_en,
    descriptionAr: row.description_ar,
    categorySlug: (row.categories as { slug: string } | null)?.slug ?? null,
    cashPrice: Number(row.cash_price),
    pointsEnabled: row.points_enabled,
    defaultPointsPrice: row.default_points_price,
    deliveryPointsReward: row.delivery_points_reward,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    images: ((row.product_images ?? []) as any[]).map((image) => ({
      url: image.url,
      altEn: image.alt_en,
      altAr: image.alt_ar,
      variantSku: image.variant_id ? (skuById.get(image.variant_id) ?? null) : null,
      sortOrder: image.sort_order,
      isPrimary: image.is_primary,
    })),
  };

  const docs = buildPackageDocuments(product);
  const files: Record<string, Uint8Array> = {
    "product.json": strToU8(docs.productJson),
    "descriptions.json": strToU8(docs.descriptionsJson),
    "variants.json": strToU8(docs.variantsJson),
  };

  const missing = [...docs.rejected];
  let totalBytes = 0;

  for (const item of docs.plan) {
    const target = item.url.startsWith("/") ? `${input.origin}${item.url}` : item.url;
    try {
      const response = await fetch(target);
      if (!response.ok) {
        missing.push({ url: item.url, reason: `image fetch failed (${response.status})` });
        continue;
      }
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
        missing.push({ url: item.url, reason: "image size outside allowed range" });
        continue;
      }
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        missing.push({ url: item.url, reason: "package image budget exceeded" });
        break;
      }
      files[ensureImageExtension(item.entry, response.headers.get("content-type"))] = buffer;
    } catch {
      missing.push({ url: item.url, reason: "image unavailable" });
    }
  }

  const sku = packageSku(product);
  files["manifest.json"] = strToU8(
    buildManifest({
      productId: product.id,
      sku,
      generatedAt: new Date().toISOString(),
      files: Object.keys(files),
      missing,
    }),
  );

  const zipped = zipSync(files, { level: 6 });
  return {
    fileName: packageFileName(sku),
    contentBase64: toBase64(zipped),
    byteLength: zipped.byteLength,
    missing,
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
