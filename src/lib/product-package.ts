export class ProductPackageError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "PRODUCT_NOT_FOUND"
      | "PRODUCT_INACTIVE"
      | "VALIDATION_ERROR"
      | "INTERNAL_ERROR"
      | "UNAUTHENTICATED",
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
  altAr?: string | null;
  variantSku?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
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
  if (product.variants && product.variants.length > 0) {
    const active = product.variants.find((v) => v.isActive);
    if (active && active.sku.trim()) return active.sku.trim();
    const first = product.variants[0];
    if (first && first.sku.trim()) return first.sku.trim();
  }
  if (product.sku && product.sku.trim()) {
    return product.sku.trim();
  }
  return "UNKNOWN";
}

export function packageFileName(sku: string): string {
  const trimmed = sku.trim();
  if (!trimmed) {
    return "Product-UNKNOWN.zip";
  }
  const sanitized = trimmed
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `Product-${sanitized || "UNKNOWN"}.zip`;
}

export function imageEntryName(url: string, index: number): string {
  const num = String(index + 1).padStart(2, "0");
  try {
    const cleanUrl = url.split("?")[0]?.split("#")[0] ?? "";
    const normalized = cleanUrl.replace(/\\/g, "/");
    const segments = normalized.split("/").filter((s) => s.length > 0 && s !== "." && s !== "..");
    let lastSegment = segments[segments.length - 1] || "";

    if (!lastSegment && url.startsWith("http")) {
      try {
        const u = new URL(url);
        lastSegment = u.hostname;
      } catch {
        // ignore
      }
    }

    lastSegment = lastSegment.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");

    if (!lastSegment || lastSegment === "-" || lastSegment === ".") {
      lastSegment = `image-${index + 1}`;
    }

    return `images/${num}-${lastSegment}`;
  } catch {
    return `images/${num}-image-${index + 1}`;
  }
}

export function isAllowedImageSource(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  if (url.includes("..") || url.includes("\\")) return false;
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;
  if (url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

export function ensureImageExtension(entry: string, contentType: string | null): string {
  const lastDot = entry.lastIndexOf(".");
  const lastSlash = entry.lastIndexOf("/");
  if (lastDot > lastSlash && lastDot !== -1) {
    return entry;
  }

  if (!contentType) {
    return `${entry}.bin`;
  }

  const mime = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return `${entry}.jpg`;
  }
  if (mime === "image/png") {
    return `${entry}.png`;
  }
  if (mime === "image/webp") {
    return `${entry}.webp`;
  }
  if (mime === "image/gif") {
    return `${entry}.gif`;
  }
  if (mime === "image/svg+xml") {
    return `${entry}.svg`;
  }
  if (mime === "image/avif") {
    return `${entry}.avif`;
  }

  return `${entry}.bin`;
}

export function buildPackageDocuments(product: PackageProduct) {
  const plan: { url: string; entry: string }[] = [];
  const rejected: { url: string; reason: string }[] = [];
  const urlToEntry = new Map<string, string>();

  const images = product.images ?? [];
  images.forEach((img, idx) => {
    if (isAllowedImageSource(img.url)) {
      const entry = imageEntryName(img.url, idx);
      plan.push({ url: img.url, entry });
      urlToEntry.set(img.url, entry);
    } else {
      rejected.push({ url: img.url, reason: "unsupported image source" });
    }
  });

  const productJson = JSON.stringify({
    id: product.id,
    slug: product.slug,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    categorySlug: product.categorySlug ?? null,
    pricing: {
      cashPrice: product.cashPrice,
      pointsEnabled: product.pointsEnabled,
      defaultPointsPrice: product.defaultPointsPrice,
      deliveryPointsReward: product.deliveryPointsReward,
    },
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });

  const descriptionsJson = JSON.stringify({
    descriptions: {
      en: product.descriptionEn,
      ar: product.descriptionAr,
    },
    imageAltText: images
      .filter((img) => isAllowedImageSource(img.url))
      .map((img) => ({
        file: urlToEntry.get(img.url)!,
        alt: {
          en: img.altEn,
          ar: img.altAr,
        },
        isPrimary: img.isPrimary,
        variantSku: img.variantSku,
      })),
  });

  const variants = product.variants ?? [];
  const variantsJson = JSON.stringify({
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      nameEn: v.nameEn,
      nameAr: v.nameAr,
      cashPrice: v.cashPrice ?? product.cashPrice,
      pointsPrice: product.pointsEnabled ? (v.pointsPrice ?? product.defaultPointsPrice) : null,
      stock: v.stock,
      isActive: v.isActive,
      images: images
        .filter((img) => img.variantSku === v.sku && isAllowedImageSource(img.url))
        .map((img) => urlToEntry.get(img.url)!),
    })),
  });

  return {
    productJson,
    descriptionsJson,
    variantsJson,
    plan,
    rejected,
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
    productId,
    sku,
    files: [...files].sort(),
    missing,
  });
}
