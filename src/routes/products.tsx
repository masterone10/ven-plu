import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Coins,
  Gift,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  X,
  ArrowRight,
  Eye,
} from "lucide-react";
import {
  getCatalogPayload,
  type CatalogProduct,
  type PublicCategory,
} from "@/lib/catalog.functions";
import { addCartItem } from "@/lib/cart.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { altText, galleryForVariant, hasOwnMedia } from "@/lib/variant-media";
import type { PaymentMethod } from "@/lib/points-rules";
import { MediaLinkModal } from "@/components/media-link-modal";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "VEN+ Products — Pay in EGP or Points" },
      {
        name: "description",
        content:
          "Browse VEN+ catalog. Choose variants and pay with cash or points, with real delivery rewards on every order.",
      },
      { property: "og:title", content: "VEN+ Products" },
      {
        property: "og:description",
        content: "Browse VEN+ products and pay in EGP or with points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["catalog-payload"],
      queryFn: () => getCatalogPayload(),
    }),
  errorComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Could not load the catalog. Please refresh.
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Not found</div>,
  component: ProductsPage,
});

function ProductsPage() {
  const fetchCatalog = useServerFn(getCatalogPayload);
  const { data, isLoading } = useQuery({
    queryKey: ["catalog-payload"],
    queryFn: () => fetchCatalog(),
  });
  const { locale, t } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [mediaLinkProduct, setMediaLinkProduct] = useState<CatalogProduct | null>(null);

  const products: CatalogProduct[] = useMemo(() => data?.products ?? [], [data?.products]);
  const categories: PublicCategory[] = useMemo(() => data?.categories ?? [], [data?.categories]);

  // Main Catalog Search filter
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) {
        return false;
      }
      // Search query filter (matches Arabic name, English name, or variant SKUs)
      if (!q) return true;
      const matchNameAr = p.nameAr?.toLowerCase().includes(q);
      const matchNameEn = p.nameEn?.toLowerCase().includes(q);
      const matchDescAr = p.descriptionAr?.toLowerCase().includes(q);
      const matchDescEn = p.descriptionEn?.toLowerCase().includes(q);
      const matchSku = p.variants.some((v) => v.sku?.toLowerCase().includes(q));

      return Boolean(matchNameAr || matchNameEn || matchDescAr || matchDescEn || matchSku);
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {locale === "ar" ? "كتالوج المنتجات" : "Product Catalog"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "ar"
                ? "تصفح المنتجات، اكسب نقاط عند الاستلام، وادفع كاش أو بالنقاط بكل مرونة."
                : "Browse products, earn points on delivery, and pay with cash or points."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {locale === "ar"
                ? `عرض ${filteredProducts.length} من أصل ${products.length} منتج`
                : `Showing ${filteredProducts.length} of ${products.length} products`}
            </span>
          </div>
        </div>

        {/* Main Catalog Search Bar #1 */}
        <div className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === "ar"
                  ? "ابحث باسم المنتج أو كود المنتج (SKU)..."
                  : "Search by product name or SKU..."
              }
              className="ps-10 pe-10 h-11 text-sm rounded-xl border-border bg-card shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Button
              size="sm"
              variant={selectedCategory === "ALL" ? "default" : "outline"}
              onClick={() => setSelectedCategory("ALL")}
              className="rounded-full text-xs shrink-0"
            >
              {locale === "ar" ? "جميع التصنيفات" : "All Categories"}
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id)}
                className="rounded-full text-xs shrink-0"
              >
                {locale === "ar" ? cat.nameAr : cat.nameEn}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid / Empty State */}
        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-muted/20">
            <Package className="size-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">
              {locale === "ar" ? "لا توجد منتجات مطابقة لبحثك" : "No products match your search"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {locale === "ar"
                ? "جرب البحث بكلمة مفتاحية أخرى أو تغيير التصنيف المختار."
                : "Try searching with a different term or clearing the selected category."}
            </p>
            {(searchQuery || selectedCategory !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                }}
                className="mt-4 text-xs"
              >
                {locale === "ar" ? "إعادة ضبط البحث" : "Reset Search"}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenMediaLink={() => setMediaLinkProduct(product)}
              />
            ))}
          </div>
        )}

        {/* Media Link Global Dialog */}
        <MediaLinkModal
          product={mediaLinkProduct}
          selectedVariant={null}
          open={Boolean(mediaLinkProduct)}
          onOpenChange={(open) => {
            if (!open) setMediaLinkProduct(null);
          }}
        />
      </main>
    </div>
  );
}

function ProductCard({
  product,
  onOpenMediaLink,
}: {
  product: CatalogProduct;
  onOpenMediaLink: () => void;
}) {
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

  const gallery = useMemo(
    () => galleryForVariant(product.images, variantId),
    [product.images, variantId],
  );
  const active = gallery[Math.min(imageIndex, gallery.length - 1)] ?? null;
  const fallbackAlt = variantName ? `${name} — ${variantName}` : name;

  function selectVariant(nextId: string) {
    setVariantId(nextId);
    setImageIndex(0);
    if (!(product.pointsEnabled && variant?.pointsPrice != null)) setMethod("CASH");
  }

  async function onAdd(e: React.MouseEvent) {
    e.stopPropagation();
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
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm hover:shadow-md transition-all">
      {/* Product Image & Link to Details */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        <Link to="/products/$slug" params={{ slug: product.slug }} className="block size-full">
          {active ? (
            <img
              src={active.url}
              alt={altText(active, locale, fallbackAlt)}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground/40">
              <Package className="size-12 stroke-1" />
            </div>
          )}
        </Link>

        {/* Delivery Points Reward Badge */}
        <div className="absolute top-3 start-3">
          <Badge className="bg-emerald-600/95 hover:bg-emerald-600 text-white shadow-sm gap-1 px-2.5 py-0.5 text-[11px] font-semibold">
            <Gift className="size-3" />+{product.deliveryPointsReward}{" "}
            {locale === "ar" ? "نقطة عند الاستلام" : "pts reward"}
          </Badge>
        </div>

        {/* Quick Media Link trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMediaLink();
          }}
          className="absolute bottom-3 end-3 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm hover:bg-background border border-border/80 transition opacity-90 group-hover:opacity-100"
        >
          <Sparkles className="size-3 text-accent" />
          <span>Media Link</span>
        </button>
      </div>

      <CardHeader className="pb-2 pt-4 px-4">
        {product.categoryNameAr && (
          <span className="text-[11px] font-semibold text-muted-foreground block mb-0.5">
            {locale === "ar" ? product.categoryNameAr : product.categoryNameEn}
          </span>
        )}
        <CardTitle className="text-base font-bold line-clamp-1">
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="hover:text-primary transition"
          >
            {name}
          </Link>
        </CardTitle>
        <div className="flex flex-wrap items-baseline gap-2 pt-1">
          <span className="text-lg font-black text-foreground">
            {formatEGP(variant?.cashPrice ?? product.cashPrice)}
          </span>
          {canUsePoints && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Coins className="size-3 text-accent" />
              {formatPoints(variant!.pointsPrice!)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 px-4 pb-3">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {locale === "ar" ? product.descriptionAr : product.descriptionEn}
        </p>

        {/* Variants Selection */}
        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.variants.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                size="sm"
                variant={candidate.id === variantId ? "default" : "outline"}
                className="h-7 px-2.5 text-xs rounded-lg"
                onClick={() => selectVariant(candidate.id)}
              >
                {locale === "ar" ? candidate.nameAr : candidate.nameEn}
              </Button>
            ))}
          </div>
        )}

        {/* Cash / Points selection for quick add */}
        <div className="flex gap-1.5 pt-1">
          <Button
            type="button"
            size="sm"
            variant={method === "CASH" ? "default" : "outline"}
            className="h-7 text-xs flex-1 rounded-lg"
            onClick={() => setMethod("CASH")}
          >
            {locale === "ar" ? "كاش" : "Cash"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={method === "POINTS" ? "default" : "outline"}
            className="h-7 text-xs flex-1 rounded-lg"
            disabled={!canUsePoints}
            onClick={() => setMethod("POINTS")}
          >
            {locale === "ar" ? "نقاط" : "Points"}
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>
            {locale === "ar"
              ? `المتاح: ${variant?.stock ?? 0} قطعة`
              : `Stock: ${variant?.stock ?? 0}`}
          </span>
          <span className="font-mono text-[10px]">{variant?.sku || product.slug}</span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-xl text-xs flex-1">
          <Link to="/products/$slug" params={{ slug: product.slug }}>
            <Eye className="size-3.5 me-1" />
            {locale === "ar" ? "التفاصيل" : "Details"}
          </Link>
        </Button>

        <Button
          size="sm"
          className="rounded-xl text-xs flex-1 gap-1.5"
          disabled={busy || !variant || (variant?.stock ?? 0) < 1}
          onClick={onAdd}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShoppingBag className="size-3.5" />
          )}
          {locale === "ar" ? "أضف للسلة" : "Add to Cart"}
        </Button>
      </CardFooter>
    </Card>
  );
}
