import { describe, expect, it } from "vitest";
import {
  buildManifest,
  buildPackageDocuments,
  ensureImageExtension,
  imageEntryName,
  isAllowedImageSource,
  packageFileName,
  packageSku,
  type PackageProduct,
} from "@/lib/product-package";

const product: PackageProduct = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "vitamin-c-serum",
  nameEn: "Vitamin C Serum",
  nameAr: "سيروم فيتامين سي",
  descriptionEn: "Brightening serum",
  descriptionAr: "سيروم مضيء",
  categorySlug: "skincare",
  cashPrice: 450,
  pointsEnabled: true,
  defaultPointsPrice: 900,
  deliveryPointsReward: 20,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  variants: [
    {
      id: "v1",
      sku: "VC-30",
      nameEn: "30ml",
      nameAr: "٣٠ مل",
      cashPrice: 450,
      pointsPrice: 900,
      stock: 5,
      isActive: true,
    },
    {
      id: "v2",
      sku: "VC-50",
      nameEn: "50ml",
      nameAr: "٥٠ مل",
      cashPrice: 650,
      pointsPrice: 1200,
      stock: 0,
      isActive: false,
    },
  ],
  images: [
    {
      url: "/products/vitamin-c-serum-30ml.jpg",
      altEn: "30ml",
      altAr: "٣٠ مل",
      variantSku: "VC-30",
      sortOrder: 0,
      isPrimary: true,
    },
    {
      url: "/products/vitamin-c-serum-50ml.jpg",
      altEn: "50ml",
      altAr: "٥٠ مل",
      variantSku: "VC-50",
      sortOrder: 1,
      isPrimary: false,
    },
  ],
};

describe("packageSku / packageFileName", () => {
  it("names the archive after the first active variant sku", () => {
    expect(packageFileName(packageSku(product))).toBe("Product-VC-30.zip");
  });

  it("strips unsafe characters from the file name", () => {
    expect(packageFileName("../../etc/passwd")).toBe("Product-etc-passwd.zip");
    expect(packageFileName("  ")).toBe("Product-UNKNOWN.zip");
  });
});

describe("imageEntryName", () => {
  it("flattens every path into images/", () => {
    expect(imageEntryName("/products/a.jpg", 0)).toBe("images/01-a.jpg");
    expect(imageEntryName("https://cdn.test/x/y/z.png?sig=1", 2)).toBe("images/03-z.png");
  });

  it("cannot escape the images folder (ZIP Slip)", () => {
    const entry = imageEntryName("/a/../../../../etc/passwd", 0);
    expect(entry.startsWith("images/")).toBe(true);
    expect(entry).not.toContain("..");
    expect(imageEntryName("C:\\windows\\system32\\evil.exe", 1)).toBe("images/02-evil.exe");
  });

  it("falls back to an index-based name when nothing safe remains", () => {
    expect(imageEntryName("https://cdn.test/", 4)).toBe("images/05-cdn.test");
    expect(imageEntryName("/", 0)).toBe("images/01-image-1");
  });
});

describe("isAllowedImageSource", () => {
  it("accepts app paths and https urls", () => {
    expect(isAllowedImageSource("/products/a.jpg")).toBe(true);
    expect(isAllowedImageSource("https://cdn.test/a.jpg")).toBe(true);
  });

  it("refuses traversal, other protocols and protocol-relative urls", () => {
    for (const url of [
      "/products/../../.env",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
      "http://internal/a.jpg",
      "//evil.test/a.jpg",
      "",
    ]) {
      expect(isAllowedImageSource(url)).toBe(false);
    }
  });
});

describe("buildPackageDocuments", () => {
  const docs = buildPackageDocuments(product);

  it("emits product.json from persisted values only", () => {
    const parsed = JSON.parse(docs.productJson);
    expect(parsed.slug).toBe("vitamin-c-serum");
    expect(parsed.pricing).toEqual({
      cashPrice: 450,
      pointsEnabled: true,
      defaultPointsPrice: 900,
      deliveryPointsReward: 20,
    });
    expect(JSON.stringify(parsed)).not.toMatch(/key|secret|token|password/i);
  });

  it("emits localized descriptions with alt text mapped to entries", () => {
    const parsed = JSON.parse(docs.descriptionsJson);
    expect(parsed.descriptions).toEqual({ en: "Brightening serum", ar: "سيروم مضيء" });
    expect(parsed.imageAltText[0].file).toBe("images/01-vitamin-c-serum-30ml.jpg");
  });

  it("emits variants.json with per-variant media and effective prices", () => {
    const parsed = JSON.parse(docs.variantsJson);
    expect(parsed.variants).toHaveLength(2);
    expect(parsed.variants[1].images).toEqual(["images/02-vitamin-c-serum-50ml.jpg"]);
    expect(parsed.variants[0].cashPrice).toBe(450);
  });

  it("nulls variant points prices when the product is not points-eligible", () => {
    const docsNoPoints = buildPackageDocuments({
      ...product,
      pointsEnabled: false,
      defaultPointsPrice: null,
    });
    const parsed = JSON.parse(docsNoPoints.variantsJson);
    expect(
      parsed.variants.every((v: { pointsPrice: number | null }) => v.pointsPrice === null),
    ).toBe(true);
  });

  it("plans one archive entry per allowed image", () => {
    expect(docs.plan.map((item) => item.entry)).toEqual([
      "images/01-vitamin-c-serum-30ml.jpg",
      "images/02-vitamin-c-serum-50ml.jpg",
    ]);
    expect(docs.rejected).toEqual([]);
  });

  it("rejects unsupported image sources instead of fetching them", () => {
    const docsBad = buildPackageDocuments({
      ...product,
      images: [
        {
          url: "file:///etc/passwd",
          altEn: null,
          altAr: null,
          variantSku: null,
          sortOrder: 0,
          isPrimary: false,
        },
      ],
    });
    expect(docsBad.plan).toEqual([]);
    expect(docsBad.rejected[0]?.reason).toBe("unsupported image source");
  });
});

describe("buildManifest", () => {
  it("lists included files and explicit missing entries", () => {
    const manifest = JSON.parse(
      buildManifest({
        productId: product.id,
        sku: "VC-30",
        generatedAt: "2026-03-01T00:00:00.000Z",
        files: ["variants.json", "product.json"],
        missing: [{ url: "/products/gone.jpg", reason: "image fetch failed (404)" }],
      }),
    );
    expect(manifest.format).toBe("ven-plus-product-package/1");
    expect(manifest.files).toEqual(["product.json", "variants.json"]);
    expect(manifest.missing).toHaveLength(1);
  });
});

describe("ensureImageExtension", () => {
  it("derives an extension from the served content type when the URL has none", () => {
    expect(ensureImageExtension("images/01-photo-abc", "image/jpeg")).toBe(
      "images/01-photo-abc.jpg",
    );
    expect(ensureImageExtension("images/01-photo-abc", "image/png; charset=binary")).toBe(
      "images/01-photo-abc.png",
    );
    expect(ensureImageExtension("images/01-photo-abc", "image/webp")).toBe(
      "images/01-photo-abc.webp",
    );
  });

  it("falls back to .bin for unknown or absent content types", () => {
    expect(ensureImageExtension("images/01-photo", null)).toBe("images/01-photo.bin");
    expect(ensureImageExtension("images/01-photo", "application/octet-stream")).toBe(
      "images/01-photo.bin",
    );
  });

  it("leaves entries that already carry an extension untouched", () => {
    expect(ensureImageExtension("images/01-serum.jpg", "image/png")).toBe("images/01-serum.jpg");
    expect(ensureImageExtension("images/02-scrunchie.webp", null)).toBe("images/02-scrunchie.webp");
  });
});
