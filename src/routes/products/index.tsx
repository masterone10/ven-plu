import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Coins, Eye, Loader2, Package, Search, ShoppingBag, X } from "lucide-react";
import { listCatalog, listPublicCategories, type CatalogProduct } from "@/lib/catalog.functions";
import { addCartItem } from "@/lib/cart.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { altText, galleryForVariant, hasOwnMedia } from "@/lib/variant-media";
import type { PaymentMethod } from "@/lib/points-rules";

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "VEN+ products — pay in EGP or with points" },
      {
        name: "description",
        content:
          "Browse VEN+ skincare, haircare, and accessories. Choose a variant and pay the whole order in EGP or entirely with points.",
      },
      { property: "og:title", content: "VEN+ products" },
      {
        property: "og:description",
        content: "Browse VEN+ products and pay in EGP or entirely with points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["catalog"], queryFn: () => listCatalog() }),
      context.queryClient.ensureQueryData({
        queryKey: ["public-categories"],
        queryFn: () => listPublicCategories(),
      }),
    ]);
  },
  errorComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Could not load the catalog. Please refresh.
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Not found</div>,
  component: ProductsPage,
});

function ProductsPage() {
  const fetchCatalog = useServerFn(listCatalog);
  const fetchCategories = useServerFn(listPublicCategories);
  const { data: productsData } = useQuery({ queryKey: ["catalog"], queryFn: () => fetchCatalog() });
  const { data: categoriesData } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => fetchCategories(),
  });
  const { locale, t } = useI18n();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [onlyPoints, setOnlyPoints] = useState(false);

  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const rawProducts = useMemo(() => productsData ?? [], [productsData]);

  const filteredProducts = useMemo(() => {
    return rawProducts.filter((product) => {
      if (selectedCategoryId !== "ALL" && product.categoryId !== selectedCategoryId) {
        return false;
      }
      if (onlyPoints && !product.pointsEnabled) {
        return false;
      }
      if (!searchTerm.trim()) return true;

      const q = searchTerm.trim().toLowerCase();
      const matchName =
        product.nameAr.toLowerCase().includes(q) || product.nameEn.toLowerCase().includes(q);
      const matchDesc =
        (product.descriptionAr ?? "").toLowerCase().includes(q) ||
        (product.descriptionEn ?? "").toLowerCase().includes(q);
      const matchSku = product.variants.some((v) => v.sku.toLowerCase().includes(q));

      return matchName || matchDesc || matchSku;
    });
  }, [rawProducts, selectedCategoryId, onlyPoints, searchTerm]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">
            {locale === "ar" ? "كتالوج المنتجات" : "Product Catalog"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? "تصفح منتجاتنا المميزة وادفع بالكاش أو بنقاطك المكتسبة من طلباتك السابقة."
              : "Browse our premium products and pay with Cash or points earned from previous deliveries."}
          </p>
        </div>

        {/* Search #1: Main Catalog Search & Category Filters */}
        <div className="mt-6 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  locale === "ar"
                    ? "ابحث بالاسم العربي، الإنجليزي، أو كود الصنف SKU..."
                    : "Search by Arabic/English name or SKU..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-9 pe-9"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <Button
              type="button"
              variant={onlyPoints ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setOnlyPoints(!onlyPoints)}
            >
              <Coins className="size-3.5" />
              {locale === "ar" ? "متاح بالنقاط فقط" : "Points Eligible Only"}
            </Button>
          </div>

          {/* Categories Filter Pills */}
          {categories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Button
                type="button"
                size="sm"
                variant={selectedCategoryId === "ALL" ? "default" : "outline"}
                className="h-8 rounded-full text-xs"
                onClick={() => setSelectedCategoryId("ALL")}
              >
                {locale === "ar" ? "جميع الأقسام" : "All Categories"}
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  type="button"
                  size="sm"
                  variant={selectedCategoryId === cat.id ? "default" : "outline"}
                  className="h-8 rounded-full text-xs"
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  {locale === "ar" ? cat.nameAr : cat.nameEn}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <Package className="size-12 text-muted-foreground/60" />
            <h3 className="font-bold text-lg">
              {locale === "ar" ? "لم يتم العثور على منتجات" : "No products found"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "جرب البحث بكلمات أخرى أو اختر قسمًا مختلفًا."
                : "Try searching with different terms or selecting another category."}
            </p>
            {searchTerm || selectedCategoryId !== "ALL" || onlyPoints ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategoryId("ALL");
                  setOnlyPoints(false);
                }}
              >
                {locale === "ar" ? "إعادة ضبط الفلاتر" : "Reset Filters"}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground">
          <span>
            {locale === "ar"
              ? `إجمالي المنتجات المعروضة: ${filteredProducts.length}`
              : `Showing ${filteredProducts.length} products`}
          </span>
          <Link to="/cart" className="font-medium text-accent underline">
            {t("cart")}
          </Link>
        </div>
      </main>
    </div>
  );
}

/** Points price of a specific variant, falling back to the product default. */
function pointsPriceOf(product: CatalogProduct, variantId: string): number | null {
  const variant = product.variants.find((candidate) => candidate.id === variantId);
  return variant?.pointsPrice ?? null;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const { session } = useSession();
  const router = useRouter();
  const add = useServerFn(addCartItem);

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const variant = product.variants.find((candidate) => candidate.id === variantId);
  const name = locale === "ar" ? product.nameAr : product.nameEn;
  const variantName = variant ? (locale === "ar" ? variant.nameAr : variant.nameEn) : "";
  const canUsePoints = product.pointsEnabled && variant?.pointsPrice != null;

  // Real persisted media for the selected variant; no hue rotation or tinting.
  const gallery = useMemo(
    () => galleryForVariant(product.images, variantId),
    [product.images, variantId],
  );
  const active = gallery[Math.min(imageIndex, gallery.length - 1)] ?? null;
  const ownMedia = hasOwnMedia(product.images, variantId);
  const fallbackAlt = variantName ? `${name} — ${variantName}` : name;

  function selectVariant(nextId: string) {
    setVariantId(nextId);
    setImageIndex(0);
    if (!(product.pointsEnabled && pointsPriceOf(product, nextId) != null)) setMethod("CASH");
  }

  async function onAdd() {
    if (!session) {
      void router.navigate({ to: "/auth", search: { redirect: "/products" } });
      return;
    }
    if (!variant) return;
    setBusy(true);
    try {
      await add({ data: { variantId: variant.id, quantity: 1, paymentMethod: method } });
      toast.success(locale === "ar" ? "تمت الإضافة إلى السلة" : "Added to cart");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "INTERNAL_ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      {active ? (
        <div className="space-y-2 bg-muted/30 p-2">
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="block overflow-hidden rounded-md"
          >
            <img
              key={active.url}
              src={active.url}
              alt={altText(active, locale, fallbackAlt)}
              loading="lazy"
              width={800}
              height={800}
              className="h-48 w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </Link>
          {gallery.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {gallery.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  aria-label={altText(image, locale, fallbackAlt)}
                  aria-current={index === imageIndex}
                  onClick={() => setImageIndex(index)}
                  className={`size-9 overflow-hidden rounded-md border transition-colors ${
                    index === imageIndex ? "border-accent ring-2 ring-accent/30" : "border-border"
                  }`}
                >
                  <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    width={80}
                    height={80}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
          {variant ? (
            <p className="text-[11px] text-muted-foreground">
              {ownMedia
                ? locale === "ar"
                  ? `صورة ${variantName} — ${variant.sku}`
                  : `${variantName} photo — ${variant.sku}`
                : locale === "ar"
                  ? `صورة عامة للمنتج — ${variant.sku}`
                  : `Shared product photo — ${variant.sku}`}
            </p>
          ) : null}
        </div>
      ) : null}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="text-base font-bold transition-colors hover:text-accent"
          >
            {name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-foreground">
            {formatEGP(variant?.cashPrice ?? product.cashPrice)}
          </span>
          {canUsePoints ? (
            <Badge variant="secondary" className="gap-1">
              <Coins className="size-3" />
              {formatPoints(variant!.pointsPrice!)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {locale === "ar" ? product.descriptionAr : product.descriptionEn}
        </p>

        {product.variants.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {product.variants.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                size="sm"
                variant={candidate.id === variantId ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => selectVariant(candidate.id)}
              >
                {locale === "ar" ? candidate.nameAr : candidate.nameEn}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={method === "CASH" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setMethod("CASH")}
          >
            {locale === "ar" ? "كاش" : "Cash"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={method === "POINTS" ? "default" : "outline"}
            disabled={!canUsePoints}
            className="h-7 text-xs"
            onClick={() => setMethod("POINTS")}
          >
            {locale === "ar" ? "نقاط" : "Points"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {locale === "ar"
            ? `المتاح: ${variant?.stock ?? 0} — مكافأة التسليم ${product.deliveryPointsReward} نقطة`
            : `In stock: ${variant?.stock ?? 0} — delivery reward ${product.deliveryPointsReward} points`}
        </p>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button asChild variant="outline" size="sm" className="flex-1 gap-1 text-xs">
          <Link to="/products/$slug" params={{ slug: product.slug }}>
            <Eye className="size-3.5" />
            {locale === "ar" ? "تفاصيل" : "Details"}
          </Link>
        </Button>
        <Button
          className="flex-1 gap-1 text-xs"
          size="sm"
          disabled={busy || !variant || (variant?.stock ?? 0) < 1}
          onClick={() => void onAdd()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShoppingBag className="size-3.5" />
          )}
          {locale === "ar" ? "إضافة للسلة" : "Add"}
        </Button>
      </CardFooter>
    </Card>
  );
}
