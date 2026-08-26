/**
 * VEN+ Work Item 4 — Advanced Admin Product Management: pure rules.
 *
 * Everything here is deterministic and dependency-free so the same rules can be
 * unit tested and reused by the server functions. No authorization decision is
 * taken here: authorization is server-side only (`has_role`, RLS).
 *
 * Funding stays split as in the canonical contract: a product carries a cash
 * price and, when points purchase is enabled, a points price. A variant points
 * price is rejected whenever the product is not points-enabled.
 */
import { z } from "zod";

export class AdminProductError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "VALIDATION_ERROR"
      | "PRODUCT_NOT_FOUND"
      | "CATEGORY_INACTIVE"
      | "SLUG_TAKEN"
      | "SKU_TAKEN"
      | "VARIANT_IN_USE"
      | "INTERNAL_ERROR",
    public readonly detail?: string,
  ) {
    super(code);
    this.name = "AdminProductError";
  }
}

export const forbidden = () => new AdminProductError("FORBIDDEN");
export const validationError = (detail: string) => new AdminProductError("VALIDATION_ERROR", detail);

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const skuPattern = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(slugPattern, "slug must be lowercase words separated by single hyphens");

export const skuSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(skuPattern, "sku must be uppercase letters, digits and hyphens");

/** Money is stored with 2 decimals; reject negatives and silly precision. */
export const cashPriceSchema = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine((value) => Math.round(value * 100) === value * 100, "at most two decimals");

export const pointsPriceSchema = z.number().int().min(1).max(10_000_000);

export const variantInputSchema = z.object({
  /** Absent for a new variant. */
  id: z.string().uuid().optional(),
  sku: skuSchema,
  nameEn: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  cashPrice: cashPriceSchema.nullable(),
  pointsPrice: pointsPriceSchema.nullable(),
  stock: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
});

export const mediaInputSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().trim().min(1).max(2048),
  altEn: z.string().trim().max(200).nullable(),
  altAr: z.string().trim().max(200).nullable(),
  /** Variant-scoped media; null means the shared product photo. */
  variantSku: z.string().trim().max(40).nullable(),
  sortOrder: z.number().int().min(0).max(999),
  isPrimary: z.boolean(),
});

export const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugSchema,
  categoryId: z.string().uuid().nullable(),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
  descriptionEn: z.string().trim().max(4000).nullable(),
  descriptionAr: z.string().trim().max(4000).nullable(),
  cashPrice: cashPriceSchema,
  pointsEnabled: z.boolean(),
  defaultPointsPrice: pointsPriceSchema.nullable(),
  deliveryPointsReward: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
  variants: z.array(variantInputSchema).min(1).max(50),
  media: z.array(mediaInputSchema).max(60),
});

export type VariantInput = z.infer<typeof variantInputSchema>;
export type MediaInput = z.infer<typeof mediaInputSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;

/**
 * Cross-field rules that a schema cannot express. Throws VALIDATION_ERROR with
 * a human-readable detail; never leaks internals.
 */
export function assertProductConsistency(input: ProductInput): void {
  if (input.pointsEnabled && input.defaultPointsPrice == null) {
    throw validationError("a points-enabled product needs a default points price");
  }
  if (!input.pointsEnabled && input.defaultPointsPrice != null) {
    throw validationError("default points price is only allowed when points purchase is on");
  }

  const skus = new Set<string>();
  for (const variant of input.variants) {
    if (skus.has(variant.sku)) throw validationError(`duplicate variant sku ${variant.sku}`);
    skus.add(variant.sku);

    // The contract: a variant points price is rejected when the product's
    // points rule makes that variant ineligible for points purchase.
    if (!input.pointsEnabled && variant.pointsPrice != null) {
      throw validationError(`variant ${variant.sku} cannot carry a points price`);
    }
  }

  if (!input.variants.some((variant) => variant.isActive)) {
    throw validationError("at least one variant must stay active");
  }

  for (const image of input.media) {
    if (image.variantSku != null && !skus.has(image.variantSku)) {
      throw validationError(`media references unknown variant ${image.variantSku}`);
    }
  }

  const primaries = input.media.filter((image) => image.isPrimary);
  const scopes = new Set<string>();
  for (const image of primaries) {
    const scope = image.variantSku ?? "__product__";
    if (scopes.has(scope)) throw validationError("only one primary image per variant scope");
    scopes.add(scope);
  }
}

/** Inactive categories cannot receive products. */
export function assertCategoryAssignable(category: { isActive: boolean } | null): void {
  if (category && !category.isActive) throw new AdminProductError("CATEGORY_INACTIVE");
}

export type AdminProductRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  categoryId: string | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  cashPrice: number;
  pointsEnabled: boolean;
  /** Product default; variants may override. */
  pointsPrice: number | null;
  variantCount: number;
  activeVariantCount: number;
  /** Server-computed from persisted variant rows, never from browser state. */
  totalStock: number;
  isActive: boolean;
  imageUrl: string | null;
};

type RawVariant = { id: string; points_price: number | null; stock: number; is_active: boolean };

/** Operational list row. Stock and variant counts are derived server-side. */
export function toAdminProductRow(
  product: {
    id: string;
    slug: string;
    name_en: string;
    name_ar: string;
    category_id: string | null;
    cash_price: number | string;
    points_enabled: boolean;
    default_points_price: number | null;
    is_active: boolean;
  },
  variants: RawVariant[],
  category: { name_en: string; name_ar: string } | null,
  imageUrl: string | null,
): AdminProductRow {
  return {
    id: product.id,
    slug: product.slug,
    nameEn: product.name_en,
    nameAr: product.name_ar,
    categoryId: product.category_id,
    categoryNameEn: category?.name_en ?? null,
    categoryNameAr: category?.name_ar ?? null,
    cashPrice: Number(product.cash_price),
    pointsEnabled: product.points_enabled,
    pointsPrice: product.points_enabled ? product.default_points_price : null,
    variantCount: variants.length,
    activeVariantCount: variants.filter((variant) => variant.is_active).length,
    totalStock: variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0),
    isActive: product.is_active,
    imageUrl,
  };
}

/** Case-insensitive, whitespace-tolerant search over the operational columns. */
export function matchesSearch(row: AdminProductRow, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return [row.nameEn, row.nameAr, row.slug, row.categoryNameEn ?? "", row.categoryNameAr ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
