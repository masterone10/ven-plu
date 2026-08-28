import { useState, useMemo } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  Gift,
  Heart,
  Loader2,
  Minus,
  Package,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { addCartItem } from "@/lib/cart.functions";
import type { PaymentMethod } from "@/lib/checkout-rules";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog.functions";
import {
  extractVariantAttributes,
  isAttributeAvailable,
  resolveVariant,
} from "@/lib/variant-resolution";
import { MediaLinkModal } from "@/components/media-link-modal";

interface ProductDetailsViewProps {
  product: CatalogProduct;
  onBack?: () => void;
}

export function ProductDetailsView({ product, onBack }: ProductDetailsViewProps) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const { session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addCartItemFn = useServerFn(addCartItem);

  const [busy, setBusy] = useState(false);

  // Dynamic attribute parsing
  const { dimensions, parsedVariants } = useMemo(
    () => extractVariantAttributes(product.variants, locale),
    [product.variants, locale],
  );

  // Initialize attribute selections
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (parsedVariants.length > 0 && parsedVariants[0]) {
      const first = parsedVariants[0];
      for (const [k, v] of Object.entries(first.attributes)) {
        initial[k] = v;
      }
    }
    return initial;
  });

  // Resolve current active variant
  const activeVariant: CatalogVariant | null = useMemo(() => {
    return resolveVariant(parsedVariants, selectedAttributes) || product.variants[0] || null;
  }, [parsedVariants, selectedAttributes, product.variants]);

  // Gallery image state
  const images = useMemo(() => {
    if (product.images.length > 0) return product.images;
    if (product.imageUrl) {
      return [
        {
          url: product.imageUrl,
          altAr: product.nameAr,
          altEn: product.nameEn,
          isPrimary: true,
          sortOrder: 0,
          variantId: null,
        },
      ];
    }
    return [];
  }, [product]);

  // If active variant has a specific image, pick that first
  const initialIndex = useMemo(() => {
    if (activeVariant) {
      const idx = images.findIndex((img) => img.variantId === activeVariant.id);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [images, activeVariant]);

  const [selectedImgIndex, setSelectedImgIndex] = useState<number>(initialIndex);
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "POINTS">("CASH");
  const [mediaLinkOpen, setMediaLinkOpen] = useState(false);

  // Handle attribute selection
  const handleSelectAttribute = (dimName: string, value: string) => {
    const next = { ...selectedAttributes, [dimName]: value };
    setSelectedAttributes(next);

    // If active variant changes, update gallery image if variant has its own image
    const nextVar = resolveVariant(parsedVariants, next);
    if (nextVar) {
      const varImgIdx = images.findIndex((img) => img.variantId === nextVar.id);
      if (varImgIdx >= 0) {
        setSelectedImgIndex(varImgIdx);
      }
    }
  };

  const name = locale === "ar" ? product.nameAr : product.nameEn;
  const description = locale === "ar" ? product.descriptionAr : product.descriptionEn;
  const currentCashPrice = activeVariant?.cashPrice ?? product.cashPrice;
  const currentPointsPrice = activeVariant?.pointsPrice ?? product.defaultPointsPrice;
  const canUsePoints = Boolean(
    product.pointsEnabled && currentPointsPrice && currentPointsPrice > 0,
  );
  const stock = activeVariant?.stock ?? 0;
  const inStock = stock > 0;

  const handleAddToCart = async () => {
    if (!session) {
      void router.navigate({ to: "/auth", search: { redirect: `/products/${product.slug}` } });
      return;
    }
    if (!activeVariant || !inStock) return;

    setBusy(true);
    try {
      await addCartItemFn({
        data: {
          variantId: activeVariant.id,
          quantity,
          paymentMethod,
        },
      });
      toast.success(
        locale === "ar" ? `تمت إضافة ${name} إلى سلة التسوق` : `Added ${name} to your cart`,
      );
      void queryClient.invalidateQueries({ queryKey: ["cart-payload"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add item to cart");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb / Back Link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/products" className="hover:text-foreground transition flex items-center gap-1">
            <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" />
            {locale === "ar" ? "العودة إلى الكتالوج" : "Back to catalog"}
          </Link>
          {product.categoryNameAr && (
            <>
              <span>/</span>
              <span className="text-foreground font-medium">
                {locale === "ar" ? product.categoryNameAr : product.categoryNameEn}
              </span>
            </>
          )}
        </div>

        {/* Media Link Quick Button in Top Bar */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMediaLinkOpen(true)}
          className="gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
        >
          <Sparkles className="size-4" />
          {locale === "ar" ? "Media Link — التسويق والوسائط" : "Media Link"}
        </Button>
      </div>

      {/* Main Product Container: Grid (Right: Gallery, Left: Info) in RTL */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
        {/* RIGHT COLUMN in RTL / Visual Gallery (5 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main Large Image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/80 bg-muted/20 shadow-sm flex items-center justify-center">
            {images.length > 0 ? (
              <img
                src={images[selectedImgIndex]?.url || images[0]?.url || ""}
                alt={name}
                className="size-full object-cover transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Package className="size-16 stroke-1 mb-2 opacity-40" />
                <span className="text-sm">{locale === "ar" ? "لا توجد صورة" : "No image"}</span>
              </div>
            )}

            {/* Delivery Reward Badge on Image */}
            <div className="absolute top-4 start-4">
              <Badge className="bg-emerald-600/95 hover:bg-emerald-600 text-white shadow-md gap-1.5 px-3 py-1 text-xs font-semibold">
                <Gift className="size-3.5" />+{product.deliveryPointsReward}{" "}
                {locale === "ar" ? "نقطة عند الاستلام" : "pts on delivery"}
              </Badge>
            </div>

            {/* Media Link overlay trigger */}
            <button
              type="button"
              onClick={() => setMediaLinkOpen(true)}
              className="absolute bottom-4 end-4 flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-foreground shadow-md hover:bg-background border border-border transition"
            >
              <Sparkles className="size-3.5 text-accent" />
              <span>Media Link</span>
            </button>
          </div>

          {/* Thumbnails row */}
          {images.length > 1 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImgIndex(idx)}
                  className={`relative size-16 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === selectedImgIndex
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-border/60 opacity-70 hover:opacity-100 hover:border-border"
                  }`}
                >
                  <img src={img.url} alt="" className="size-full object-cover" />
                  {img.variantId && (
                    <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[8px] font-semibold text-center py-0.5">
                      {locale === "ar" ? "متغير" : "Variant"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LEFT COLUMN in RTL / Product Info & Actions (7 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Header Info */}
          <div>
            {product.categoryNameAr && (
              <Badge variant="outline" className="mb-2 text-xs font-medium">
                {locale === "ar" ? product.categoryNameAr : product.categoryNameEn}
              </Badge>
            )}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {name}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {description}
            </p>
          </div>

          <Separator />

          {/* Pricing & Points Reward */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-black text-foreground">
                {formatEGP(currentCashPrice)}
              </span>
              {canUsePoints && (
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-sm font-semibold">
                  <Coins className="size-4 text-accent" />
                  {formatPoints(currentPointsPrice!)}
                </Badge>
              )}
            </div>

            {/* Delivery Reward Banner */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                <Gift className="size-4" />
              </div>
              <p className="text-xs sm:text-sm font-medium">
                {locale === "ar"
                  ? `ستحصل على +${product.deliveryPointsReward} نقطة تضاف إلى محفظتك تلقائيًا فور استلام هذا المنتج!`
                  : `You'll earn +${product.deliveryPointsReward} wallet points automatically upon order delivery!`}
              </p>
            </div>
          </div>

          {/* Dynamic Variant Attributes Selectors */}
          {dimensions.length > 0 && (
            <div className="space-y-4 pt-1">
              {dimensions.map((dim) => (
                <div key={dim.name} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">
                      {dim.name}:{" "}
                      <span className="font-normal text-muted-foreground">
                        {selectedAttributes[dim.name] || (locale === "ar" ? "اختر" : "Select")}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {dim.values.map((val) => {
                      const isSelected = selectedAttributes[dim.name] === val;
                      const { available, inStock } = isAttributeAvailable(
                        parsedVariants,
                        dim.name,
                        val,
                        selectedAttributes,
                      );

                      return (
                        <button
                          key={val}
                          type="button"
                          disabled={!available}
                          onClick={() => handleSelectAttribute(dim.name, val)}
                          className={`min-w-[48px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : available
                                ? inStock
                                  ? "bg-background text-foreground border-border hover:border-primary/50"
                                  : "bg-background/50 text-muted-foreground border-border/50 opacity-75"
                                : "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                          }`}
                        >
                          {val}
                          {!inStock && available && (
                            <span className="text-[9px] block text-amber-500 font-normal">
                              {locale === "ar" ? "نفد" : "Out"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SKU & Stock Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/60">
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{locale === "ar" ? "كود المنتج (SKU):" : "SKU:"}</span>
              <code className="font-mono font-semibold text-foreground">
                {activeVariant?.sku || product.slug}
              </code>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">{locale === "ar" ? "حالة المخزون:" : "Stock:"}</span>
              {inStock ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                >
                  {locale === "ar" ? `متوفر (${stock} قطعة)` : `In Stock (${stock})`}
                </Badge>
              ) : (
                <Badge variant="destructive">
                  {locale === "ar" ? "غير متوفر حالياً" : "Out of Stock"}
                </Badge>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">
              {locale === "ar" ? "طريقة الدفع للمنتج:" : "Payment Method:"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  paymentMethod === "CASH"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span>{locale === "ar" ? "💵 كاش عند الاستلام" : "💵 Cash"}</span>
              </button>
              <button
                type="button"
                disabled={!canUsePoints}
                onClick={() => setPaymentMethod("POINTS")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  paymentMethod === "POINTS"
                    ? "border-accent bg-accent/10 text-accent"
                    : canUsePoints
                      ? "border-border hover:bg-muted/50"
                      : "opacity-40 border-border/40 cursor-not-allowed"
                }`}
              >
                <Coins className="size-4" />
                <span>{locale === "ar" ? "🪙 شراء بالنقاط" : "🪙 Points"}</span>
              </button>
            </div>
          </div>

          {/* Quantity and Add to Cart */}
          <div className="flex items-center gap-3 pt-2">
            {/* Quantity Selector */}
            <div className="flex items-center border border-border rounded-xl bg-background p-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-10 text-center text-sm font-bold">{quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                disabled={quantity >= stock}
                onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            {/* Add To Cart Button */}
            <Button
              size="lg"
              className="flex-1 gap-2 rounded-xl text-sm font-bold shadow-md h-11"
              disabled={busy || !inStock || !activeVariant}
              onClick={handleAddToCart}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShoppingBag className="size-4" />
              )}
              {inStock
                ? locale === "ar"
                  ? "إضافة إلى السلة"
                  : "Add to Cart"
                : locale === "ar"
                  ? "نفد من المخزون"
                  : "Out of Stock"}
            </Button>
          </div>

          {/* Media Link Promo Card */}
          <Card className="border-dashed border-accent/40 bg-accent/5">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground font-bold">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    {locale === "ar"
                      ? "أدوات المسوقين — Media Link"
                      : "Marketer Assets — Media Link"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {locale === "ar"
                      ? "حمل الصور عالية الجودة وانسخ النصوص التسويقية بنقرة واحدة"
                      : "Download HD photos, copy ready ads, and share directly"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMediaLinkOpen(true)}
                className="shrink-0 text-xs font-semibold gap-1"
              >
                <Share2 className="size-3.5" />
                {locale === "ar" ? "فتح" : "Open"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Media Link Dialog */}
      <MediaLinkModal
        product={product}
        selectedVariant={activeVariant}
        open={mediaLinkOpen}
        onOpenChange={setMediaLinkOpen}
      />
    </div>
  );
}
