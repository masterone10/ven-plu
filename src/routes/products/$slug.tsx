import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Download,
  Eye,
  Gift,
  Layers,
  Loader2,
  Package,
  Share2,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCatalogProduct,
  type CatalogProduct,
  type CatalogVariant,
} from "@/lib/catalog.functions";
import { addCartItem } from "@/lib/cart.functions";
import { downloadProductPackage } from "@/lib/product-package.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { altText, galleryForVariant, hasOwnMedia } from "@/lib/variant-media";
import type { PaymentMethod } from "@/lib/points-rules";

export const Route = createFileRoute("/products/$slug")({
  head: ({ loaderData }) => {
    const product = (loaderData ?? null) as unknown as CatalogProduct | null;
    const title = product ? `${product.nameAr} | VEN+` : "VEN+ Product";
    const desc = product?.descriptionAr || product?.descriptionEn || "Shop on VEN+";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(product?.imageUrl ? [{ property: "og:image", content: product.imageUrl }] : []),
      ],
    };
  },
  loader: async ({ params, context }) => {
    const product = await context.queryClient.ensureQueryData({
      queryKey: ["product", params.slug],
      queryFn: () => getCatalogProduct({ data: { slug: params.slug } }),
    });
    if (!product) {
      throw notFound();
    }
    return product;
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
        <Package className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">المنتج غير موجود</h2>
        <p className="text-sm text-muted-foreground">
          لم نتمكن من العثور على المنتج المطلوب. ربما تم حذفه أو تغييره.
        </p>
        <Button asChild>
          <Link to="/products">تصفح كل المنتجات</Link>
        </Button>
      </div>
    </div>
  ),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const loaderProduct = Route.useLoaderData();
  const fetchProduct = useServerFn(getCatalogProduct);
  const { data: product = loaderProduct } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProduct({ data: { slug } }),
    initialData: loaderProduct,
  });
  const { locale, formatEGP, formatPoints, t } = useI18n();
  const { session } = useSession();
  const router = useRouter();
  const addItem = useServerFn(addCartItem);
  const downloadPkg = useServerFn(downloadProductPackage);

  const initialVariantId = product?.variants[0]?.id ?? "";
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isDownloadingPkg, setIsDownloadingPkg] = useState(false);
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [copiedMarketing, setCopiedMarketing] = useState(false);

  if (!product) return null;

  const currentVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];

  const gallery = galleryForVariant(product.images, currentVariant?.id ?? null);
  const ownMedia = currentVariant ? hasOwnMedia(product.images, currentVariant.id) : false;
  const currentImage = gallery[activeImageIndex] ?? gallery[0];

  const activeCashPrice = currentVariant?.cashPrice ?? product.cashPrice;
  const activePointsPrice = currentVariant?.pointsPrice ?? product.defaultPointsPrice;
  const canPayPoints = product.pointsEnabled && activePointsPrice !== null;
  const isOutOfStock = !currentVariant || currentVariant.stock < 1;

  const handleSelectVariant = (vId: string) => {
    setSelectedVariantId(vId);
    setActiveImageIndex(0);
  };

  const handleAddToCart = async () => {
    if (!currentVariant || isOutOfStock) return;
    if (!session) {
      void router.navigate({ to: "/auth" });
      return;
    }
    setIsAdding(true);
    try {
      await addItem({
        data: {
          variantId: currentVariant.id,
          quantity,
          productPaymentMethod: paymentMethod,
        },
      });
      toast.success(
        locale === "ar"
          ? `تمت إضافة ${quantity} × ${currentVariant.nameAr} إلى السلة`
          : `Added ${quantity} × ${currentVariant.nameEn} to cart`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error adding to cart");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDownloadMedia = async () => {
    setIsDownloadingPkg(true);
    try {
      const res = await downloadPkg({ data: { productId: product.id } });
      const byteCharacters = atob(res.contentBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(locale === "ar" ? "تم تحميل حزمة الميديا بنجاح" : "Media package downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download media package");
    } finally {
      setIsDownloadingPkg(false);
    }
  };

  const copyMarketingText = async () => {
    const text = `🌟 ${product.nameAr} (${product.nameEn})
${product.descriptionAr ?? ""}

💰 السعر: ${formatEGP(activeCashPrice)} ${canPayPoints ? `أو ${formatPoints(activePointsPrice!)} نقطة` : ""}
🎁 مكافأة الاستلام: ${product.deliveryPointsReward} نقطة عند استلام الطلب!
🔢 كود المنتج SKU: ${currentVariant?.sku ?? product.id}
🛍️ الخيارات المتاحة:
${product.variants.map((v) => `- ${v.nameAr} (كود: ${v.sku}) - متاح: ${v.stock}`).join("\n")}

رابط المنتج: ${window.location.href}`;

    await navigator.clipboard.writeText(text);
    setCopiedMarketing(true);
    toast.success(locale === "ar" ? "تم نسخ النص التسويقي بنجاح" : "Marketing text copied");
    setTimeout(() => setCopiedMarketing(false), 2000);
  };

  const shareProductLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.nameAr,
          text: product.descriptionAr ?? "",
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(window.location.href);
    toast.success(locale === "ar" ? "تم نسخ رابط المنتج" : "Product link copied");
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            {locale === "ar" ? "الرئيسية" : "Home"}
          </Link>
          <span>/</span>
          <Link to="/products" className="hover:text-foreground">
            {locale === "ar" ? "المنتجات" : "Products"}
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-foreground">
            {locale === "ar" ? product.nameAr : product.nameEn}
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Gallery Section */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/80 bg-muted/30">
              {currentImage ? (
                <img
                  src={currentImage.url}
                  alt={altText(currentImage, locale, product.nameAr)}
                  className="size-full object-contain p-2"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Package className="size-16 stroke-1" />
                </div>
              )}

              {gallery.length > 1 ? (
                <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-8 rounded-full bg-background/80 shadow backdrop-blur hover:bg-background"
                    onClick={() =>
                      setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : gallery.length - 1))
                    }
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-8 rounded-full bg-background/80 shadow backdrop-blur hover:bg-background"
                    onClick={() =>
                      setActiveImageIndex((prev) => (prev < gallery.length - 1 ? prev + 1 : 0))
                    }
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}

              {currentVariant ? (
                <div className="absolute bottom-3 start-3">
                  <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur">
                    {ownMedia
                      ? locale === "ar"
                        ? `صورة ${currentVariant.nameAr}`
                        : `${currentVariant.nameEn} photo`
                      : locale === "ar"
                        ? "صورة عامة للمنتج"
                        : "General product photo"}
                  </Badge>
                </div>
              ) : null}
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {gallery.map((img, idx) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`size-16 overflow-hidden rounded-lg border-2 transition-all ${
                      idx === activeImageIndex
                        ? "border-accent ring-2 ring-accent/30"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <img src={img.url} alt="" className="size-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}

            {/* Media Package Action Box */}
            <Card className="border-accent/30 bg-accent/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-accent" />
                    <CardTitle className="text-sm font-bold">
                      {locale === "ar" ? "رابط وحزمة الميديا" : "Media Link & Package"}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {locale === "ar" ? "للمسوقين والتجار" : "For Marketers"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {locale === "ar"
                    ? "عرض وتحميل جميع صور المنتج والخيارات والنصوص التسويقية بجودة عالية."
                    : "View and download all high-resolution photos, variants, and marketing descriptions."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setMediaPreviewOpen(true)}
                >
                  <Eye className="size-3.5" />
                  {locale === "ar" ? "معاينة الصور" : "Preview Media"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={copyMarketingText}
                >
                  {copiedMarketing ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {locale === "ar" ? "نسخ الوصف التسويقي" : "Copy Marketing Info"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={isDownloadingPkg}
                  onClick={handleDownloadMedia}
                >
                  {isDownloadingPkg ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {locale === "ar" ? "تحميل ZIP للصور" : "Download Media ZIP"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={shareProductLink}
                >
                  <Share2 className="size-3.5" />
                  {locale === "ar" ? "مشاركة" : "Share"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Product Details Section */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  {locale === "ar" ? product.nameAr : product.nameEn}
                </h1>
                {product.nameEn && locale === "ar" ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{product.nameEn}</p>
                ) : null}
              </div>

              {/* Price & Delivery Reward Callout */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl font-black text-foreground">
                  {formatEGP(activeCashPrice)}
                </span>
                {canPayPoints ? (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm font-bold">
                    <Coins className="size-4 text-accent" />
                    {formatPoints(activePointsPrice!)}
                  </Badge>
                ) : null}
              </div>

              {/* Delivery Reward Box */}
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <Gift className="size-5 shrink-0 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    {locale === "ar"
                      ? `ستحصل على +${product.deliveryPointsReward} نقطة عند استلام هذا الطلب!`
                      : `You will earn +${product.deliveryPointsReward} points upon order delivery!`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? "تضاف النقاط إلى محفظتك تلقائيًا ويمكنك استخدامها في مشترياتك القادمة."
                      : "Points are added to your wallet automatically for your next orders."}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {locale === "ar" ? "الوصف" : "Description"}
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {locale === "ar" ? product.descriptionAr : product.descriptionEn}
                </p>
              </div>

              <Separator />

              {/* Variant Selector (Color, Size, Volume, Persisted Option) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">
                    {locale === "ar" ? "الخيارات المتاحة (اللون / المقاس)" : "Variant Options"}
                  </Label>
                  {currentVariant ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      SKU: {currentVariant.sku}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = v.id === selectedVariantId;
                    const isVOutOfStock = v.stock < 1;
                    return (
                      <Button
                        key={v.id}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        disabled={isVOutOfStock}
                        onClick={() => handleSelectVariant(v.id)}
                        className={`h-auto min-h-10 px-3.5 py-2 text-start transition-all ${
                          isSelected ? "ring-2 ring-accent/40" : ""
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">
                            {locale === "ar" ? v.nameAr : v.nameEn}
                          </div>
                          <div className="text-[11px] opacity-80">
                            {formatEGP(v.cashPrice)} •{" "}
                            {locale === "ar" ? `متاح: ${v.stock}` : `Stock: ${v.stock}`}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-bold">
                  {locale === "ar" ? "طريقة الدفع للمنتج" : "Product Payment Method"}
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === "CASH" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("CASH")}
                  >
                    {locale === "ar"
                      ? `كاش (${formatEGP(activeCashPrice)})`
                      : `Cash (${formatEGP(activeCashPrice)})`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === "POINTS" ? "default" : "outline"}
                    disabled={!canPayPoints}
                    onClick={() => setPaymentMethod("POINTS")}
                  >
                    {locale === "ar"
                      ? `نقاط (${canPayPoints ? formatPoints(activePointsPrice!) : "غير متاح"})`
                      : `Points (${canPayPoints ? formatPoints(activePointsPrice!) : "Unavailable"})`}
                  </Button>
                </div>
              </div>

              {/* Quantity Selector & Stock Indicator */}
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {locale === "ar" ? "الكمية" : "Quantity"}
                  </Label>
                  <div className="flex items-center rounded-lg border border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-none rounded-s-lg"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      -
                    </Button>
                    <span className="w-10 text-center font-bold">{quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-none rounded-e-lg"
                      disabled={!currentVariant || quantity >= currentVariant.stock}
                      onClick={() => setQuantity((q) => q + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="pt-4">
                  {isOutOfStock ? (
                    <Badge variant="destructive">
                      {locale === "ar" ? "نفدت الكمية" : "Out of stock"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    >
                      {locale === "ar"
                        ? `متوفر بالمخزون (${currentVariant?.stock} قطعة)`
                        : `In stock (${currentVariant?.stock} units)`}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <Button
                type="button"
                size="lg"
                className="w-full gap-2 text-base font-bold shadow-md"
                disabled={isAdding || isOutOfStock}
                onClick={handleAddToCart}
              >
                {isAdding ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ShoppingBag className="size-5" />
                )}
                {isOutOfStock
                  ? locale === "ar"
                    ? "نفدت الكمية"
                    : "Out of Stock"
                  : locale === "ar"
                    ? "أضف إلى السلة"
                    : "Add to Cart"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full gap-2 font-bold"
                disabled={isDownloadingPkg}
                onClick={handleDownloadMedia}
              >
                {isDownloadingPkg ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <Download className="size-5 text-primary" />
                )}
                {locale === "ar" ? "تحميل المنتج (ملفات وصور)" : "Download Product Package"}
              </Button>

              <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                <Truck className="size-3.5" />
                {locale === "ar"
                  ? "توصيل سريع لجميع المحافظات مع خيارات دفع مرنة بالكاش أو النقاط"
                  : "Fast delivery with flexible payment in Cash or Points"}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Media Preview Dialog */}
      <Dialog open={mediaPreviewOpen} onOpenChange={setMediaPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "معاينة وسائط وصور المنتج" : "Product Media Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {product.images.map((img) => (
              <div key={img.url} className="overflow-hidden rounded-lg border border-border">
                <img
                  src={img.url}
                  alt={altText(img, locale, product.nameAr)}
                  className="aspect-square size-full object-contain p-2"
                />
                <div className="border-t border-border bg-muted/40 p-2 text-center text-[11px] text-muted-foreground">
                  {img.variantId
                    ? `${locale === "ar" ? "صورة لخيار محدد" : "Variant specific"}`
                    : `${locale === "ar" ? "صورة عامة للمنتج" : "Shared photo"}`}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
