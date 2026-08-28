import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog.functions";
import { useServerFn } from "@tanstack/react-start";
import { downloadProductPackage } from "@/lib/product-package.functions";

interface MediaLinkModalProps {
  product: CatalogProduct | null;
  selectedVariant: CatalogVariant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaLinkModal({
  product,
  selectedVariant,
  open,
  onOpenChange,
}: MediaLinkModalProps) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);

  const downloadPkgFn = useServerFn(downloadProductPackage);

  if (!product) return null;

  const currentVariant = selectedVariant || product.variants[0] || null;
  const name = locale === "ar" ? product.nameAr : product.nameEn;
  const description = locale === "ar" ? product.descriptionAr : product.descriptionEn;
  const currentPrice = currentVariant?.cashPrice ?? product.cashPrice;
  const currentPoints = currentVariant?.pointsPrice ?? product.defaultPointsPrice;

  // Generate marketing copy text
  const marketingCopy = `✨ ${name} ✨
${description || ""}

💰 السعر: ${formatEGP(currentPrice)}
${product.pointsEnabled && currentPoints ? `🪙 سعر الشراء بالنقاط: ${formatPoints(currentPoints)}` : ""}
🎁 مكافأة الاستلام: +${product.deliveryPointsReward} نقطة عند استلام الطلب

📦 كود المنتج (SKU): ${currentVariant?.sku || product.slug}
🛒 للطلب والتفاصيل: ${typeof window !== "undefined" ? `${window.location.origin}/products/${product.slug}` : ""}`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(marketingCopy);
      setCopied(true);
      toast.success(locale === "ar" ? "تم نسخ النص التسويقي بنجاح" : "Marketing text copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(locale === "ar" ? "فشل نسخ النص" : "Failed to copy text");
    }
  };

  const handleCopyLink = async () => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/products/${product.slug}` : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success(locale === "ar" ? "تم نسخ رابط المنتج" : "Product link copied");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error(locale === "ar" ? "فشل نسخ الرابط" : "Failed to copy link");
    }
  };

  const handleShare = async () => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/products/${product.slug}` : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: marketingCopy,
          url,
        });
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const res = await downloadPkgFn({ data: { productId: product.id } });
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
      URL.revokeObjectURL(url);
      toast.success(
        locale === "ar"
          ? `تم تحميل حزمة الوسائط لـ ${name}`
          : `Media package downloaded for ${name}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to download media package");
    } finally {
      setDownloading(false);
    }
  };

  const images =
    product.images.length > 0
      ? product.images
      : product.imageUrl
        ? [
            {
              url: product.imageUrl,
              altAr: product.nameAr,
              altEn: product.nameEn,
              isPrimary: true,
              sortOrder: 0,
              variantId: null,
            },
          ]
        : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {locale === "ar"
                  ? "رابط الوسائط والتسويق — Media Link"
                  : "Media Link & Marketing Hub"}
              </DialogTitle>
              <DialogDescription>
                {locale === "ar"
                  ? "صور عالية الجودة، نصوص تسويقية جاهزة، وروابط للمشاركة الفورية"
                  : "High-resolution assets, ready-to-use marketing copy, and instant sharing links"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="gap-1.5 h-10 text-xs"
            >
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              {locale === "ar" ? "نسخ النص" : "Copy Text"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 h-10 text-xs"
            >
              {copiedLink ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {locale === "ar" ? "نسخ الرابط" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-1.5 h-10 text-xs"
            >
              <Share2 className="size-4 text-primary" />
              {locale === "ar" ? "مشاركة" : "Share"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadZip}
              disabled={downloading}
              className="gap-1.5 h-10 text-xs"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileArchive className="size-4" />
              )}
              {locale === "ar" ? "تحميل الحزمة ZIP" : "Download ZIP"}
            </Button>
          </div>

          {/* Tabs: Marketing Copy vs Media Assets */}
          <Tabs defaultValue="copy" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="copy">
                {locale === "ar" ? "النص التسويقي والمواصفات" : "Marketing Text"}
              </TabsTrigger>
              <TabsTrigger value="media">
                {locale === "ar" ? "معرض الصور والأصول" : "Photo Gallery"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="copy" className="mt-4 space-y-4">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4 relative group">
                <pre className="text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed text-foreground">
                  {marketingCopy}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyText}
                  className="absolute top-3 end-3 opacity-90 hover:opacity-100 gap-1.5 text-xs shadow-sm"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied
                    ? locale === "ar"
                      ? "تم النسخ"
                      : "Copied"
                    : locale === "ar"
                      ? "نسخ"
                      : "Copy"}
                </Button>
              </div>

              {/* Product Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-3 rounded-md border border-border/60 bg-card text-center">
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === "ar" ? "سعر البيع" : "Cash Price"}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {formatEGP(currentPrice)}
                  </span>
                </div>
                {product.pointsEnabled && currentPoints ? (
                  <div className="p-3 rounded-md border border-border/60 bg-card text-center">
                    <span className="text-[11px] text-muted-foreground block">
                      {locale === "ar" ? "سعر النقاط" : "Points Price"}
                    </span>
                    <span className="text-sm font-bold text-accent">
                      {formatPoints(currentPoints)}
                    </span>
                  </div>
                ) : null}
                <div className="p-3 rounded-md border border-border/60 bg-card text-center">
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === "ar" ? "مكافأة الاستلام" : "Delivery Reward"}
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{product.deliveryPointsReward} نقطة
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="media" className="mt-4 space-y-4">
              {images.length > 0 ? (
                <div className="space-y-3">
                  {/* Selected image preview */}
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/20 flex items-center justify-center">
                    <img
                      src={images[selectedImgIndex]?.url || images[0]?.url || ""}
                      alt={name}
                      className="size-full object-contain"
                    />
                    <a
                      href={images[selectedImgIndex]?.url || images[0]?.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 end-2 bg-background/80 backdrop-blur-sm border border-border text-foreground px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-background transition"
                    >
                      <ExternalLink className="size-3" />
                      {locale === "ar" ? "عرض الحجم الكامل" : "Full resolution"}
                    </a>
                  </div>

                  {/* Thumbnail slider */}
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImgIndex(idx)}
                        className={`relative size-14 rounded-md overflow-hidden border-2 transition-all ${
                          idx === selectedImgIndex
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border/60 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={img.url} alt="" className="size-full object-cover" />
                        {img.isPrimary && (
                          <Badge
                            variant="secondary"
                            className="absolute bottom-0 inset-x-0 rounded-none text-[8px] justify-center py-0"
                          >
                            {locale === "ar" ? "رئيسية" : "Main"}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {locale === "ar" ? "لا توجد صور إضافية لهذا المنتج" : "No additional images"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
