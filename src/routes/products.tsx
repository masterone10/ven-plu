import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Coins, Loader2, ShoppingBag } from "lucide-react";
import { listCatalog, type CatalogProduct } from "@/lib/catalog.functions";
import { addCartItem } from "@/lib/cart.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { altText, galleryForVariant, hasOwnMedia } from "@/lib/variant-media";
import type { PaymentMethod } from "@/lib/points-rules";

export const Route = createFileRoute("/products")({
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
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["catalog"], queryFn: () => listCatalog() }),
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
  const { data } = useQuery({ queryKey: ["catalog"], queryFn: () => fetchCatalog() });
  const { locale, t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-black tracking-tight">
          {locale === "ar" ? "المنتجات" : "Products"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locale === "ar"
            ? "اختر المقاس وطريقة الدفع: الطلب بالكامل كاش أو بالكامل نقاط."
            : "Pick a variant and a payment method: an order is fully cash or fully points."}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          <Link to="/cart" className="font-medium text-accent underline">
            {t("cart")}
          </Link>
        </p>
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
    <Card className="flex h-full flex-col overflow-hidden">
      {active ? (
        <div className="space-y-2 bg-muted/40 p-2">
          <img
            key={active.url}
            src={active.url}
            alt={altText(active, locale, fallbackAlt)}
            loading="lazy"
            width={800}
            height={800}
            className="h-44 w-full rounded-md object-cover transition-opacity duration-200"
          />
          {gallery.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {gallery.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  aria-label={altText(image, locale, fallbackAlt)}
                  aria-current={index === imageIndex}
                  onClick={() => setImageIndex(index)}
                  className={`size-10 overflow-hidden rounded-md border transition-colors ${
                    index === imageIndex ? "border-accent" : "border-border"
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
        <CardTitle className="text-base">{name}</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{formatEGP(variant?.cashPrice ?? product.cashPrice)}</span>
          {canUsePoints ? (
            <Badge variant="secondary" className="gap-1">
              <Coins className="size-3" />
              {formatPoints(variant!.pointsPrice!)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground">
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
            onClick={() => setMethod("CASH")}
          >
            {locale === "ar" ? "كاش" : "Cash"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={method === "POINTS" ? "default" : "outline"}
            disabled={!canUsePoints}
            onClick={() => setMethod("POINTS")}
          >
            {locale === "ar" ? "نقاط" : "Points"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {locale === "ar"
            ? `المتاح: ${variant?.stock ?? 0} — مكافأة التسليم ${product.deliveryPointsReward} نقطة`
            : `In stock: ${variant?.stock ?? 0} — delivery reward ${product.deliveryPointsReward} points`}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={busy || !variant || (variant?.stock ?? 0) < 1}
          onClick={() => void onAdd()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
          {locale === "ar" ? "أضف إلى السلة" : "Add to cart"}
        </Button>
      </CardFooter>
    </Card>
  );
}
