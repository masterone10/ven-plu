export class ProductPackageError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "PRODUCT_NOT_FOUND" | "PRODUCT_INACTIVE" | "VALIDATION_ERROR" | "INTERNAL_ERROR" | "UNAUTHENTICATED",
    public readonly detail?: string,
  ) {
    super(code);
    this.name = "ProductPackageError";
  }
}

export type PackageVariant = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  cashPrice: number | null;
  pointsPrice: number | null;
  stock: number;
  isActive: boolean;
  images?: {
    url: string;
    altEn: string | null;
    altAr: string | null;
    variantSku: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }[];
};

export type PackageImage = {
  url: string;
  altEn: string | null;
};

export type PackageProduct = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categorySlug: string | null;
  cashPrice: number;
  pointsEnabled: boolean;
  defaultPointsPrice: number | null;
  deliveryPointsReward: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sku?: string;
  variants?: PackageVariant[];
  images: {
    url: string;
    altEn: string | null;
    altAr: string | null;
    variantSku: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }[];
};

export type PackageEntryPlan = {
  id: string;
  planType: string;
  interval: string;
  price: number;
};

export type PackageDocuments = {
  missing: { url: string; reason: string }[];
};

export type PackageManifest = {
  format: string;
  generatedAt: string;
  productId: string;
  sku: string;
  files: string[];
  missing: { url: string; reason: string }[];
};

export type ProductPackageResult = {
  fileName: string;
  contentBase64: string;
  byteLength: number;
  missing: { url: string; reason: string }[];
};

export function packageSku(product: PackageProduct): string {
  return product.sku || "";
}

export function packageFileName(sku: string): string {
  return `product-${sku}.zip`;
}

export function imageEntryName(url: string, index: number): string {
  return `image-${index}.webp`;
}

export function ensureImageExtension(entry: string, contentType: string | null): string {
  if (entry.includes(".")) {
    return entry;
  }
  const ext = contentType?.split("/")[1] ?? "bin";
  return entry + "." + ext;
}

export function isAllowedImageSource(url: string): boolean {
  return url.startsWith("/") || url.startsWith("https://");
}

export function buildPackageDocuments(product: PackageProduct) {
  const variantsJson = JSON.stringify({
    variants: product.variants?.map((v: PackageVariant) => ({
      id: v.id,
      sku: v.sku,
      nameEn: v.nameEn,
      nameAr: v.nameAr,
      cashPrice: v.cashPrice,
      pointsPrice: v.pointsPrice,
      stock: v.stock,
      isActive: v.isActive,
      images: v.images?.map((img) => ({
        url: img.url,
        altEn: img.altEn,
        altAr: img.altAr,
        variantSku: img.variantSku,
        sortOrder: img.sortOrder,
        isPrimary: img.isPrimary,
      })) || [],
    })) || [],
  });

  const descriptions = product.variants
    ? product.variants.reduce(
        (acc, v) => ({
          ...acc,
          en: v.nameEn,
          ar: v.nameAr,
        }),
        { en: product.nameEn, ar: product.nameAr }
      )
    : { en: product.nameEn, ar: product.nameAr };

  return {
    productJson: JSON.stringify({
      id: product.id,
      slug: product.slug,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      cashPrice: product.cashPrice,
      pointsEnabled: product.pointsEnabled,
      defaultPointsPrice: product.defaultPointsPrice,
      deliveryPointsReward: product.deliveryPointsReward,
      isActive: product.isActive,
    }),
    descriptionsJson: JSON.stringify({ descriptions }),
    variantsJson,
    rejected: [] as Array<{ url: string; reason: string }>,
    plan: product.images?.map((img) => ({
      url: img.url,
      entry: img.url,
    })) || [],
  };
}

export function buildManifest({
  productId,
  sku,
  generatedAt,
  files,
  missing,
}: {
  productId: string;
  sku: string;
  generatedAt: string;
  files: string[];
  missing: { url: string; reason: string }[];
}): string {
  return JSON.stringify({
    format: "ven-plus-product-package/1",
    generatedAt,
    files,
    missing,
  });
}
