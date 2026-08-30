import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  Plus,
  Coins,
  Check,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { CatalogProduct } from "@/lib/catalog.functions";
import type { PaymentMethod } from "@/lib/points-rules";
import { extractMatrixFromVariants } from "@/lib/variant-matrix";
import { CustomerQuantityMatrix } from "@/components/customer-quantity-matrix";

interface InCheckoutProductPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: CatalogProduct[];
  onAddMultiple: (
    items: Array<{ variantId: string; quantity: number; paymentMethod: PaymentMethod }>,
  ) => Promise<void>;
}

export function InCheckoutProductPicker({
  open,
  onOpenChange,
  catalog,
  onAddMultiple,
}: InCheckoutProductPickerProps) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [busy, setBusy] = useState(false);

  // Single-variant fallback state (if product is not Color × Size)
  const [fallbackVariantId, setFallbackVariantId] = useState<string>("");
  const [fallbackQty, setFallbackQty] = useState<number>(1);
  const [fallbackPaymentMethod, setFallbackPaymentMethod] = useState<PaymentMethod>("CASH");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 10);
    return catalog
      .filter(
        (p) =>
          p.nameAr.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.variants.some(
            (v) =>
              v.sku.toLowerCase().includes(q) ||
              v.nameAr.toLowerCase().includes(q) ||
              v.nameEn.toLowerCase().includes(q),
          ),
      )
      .slice(0, 10);
  }, [search, catalog]);

  const matrixData = useMemo(() => {
    if (!selectedProduct) return null;
    return extractMatrixFromVariants(selectedProduct.variants, selectedProduct.slug);
  }, [selectedProduct]);

  const hasColorSizeMatrix = Boolean(
    matrixData && matrixData.colors.length > 0 && matrixData.sizes.length > 0,
  );

  const handleSelectProduct = (prod: CatalogProduct) => {
    setSelectedProduct(prod);
    if (prod.variants.length > 0 && prod.variants[0]) {
      setFallbackVariantId(prod.variants[0].id);
      setFallbackQty(1);
      setFallbackPaymentMethod("CASH");
    }
  };

  const handleClose = () => {
    setSelectedProduct(null);
    setSearch("");
    onOpenChange(false);
  };

  const handleAddFallback = async () => {
    if (!selectedProduct || !fallbackVariantId || fallbackQty <= 0) return;
    setBusy(true);
    try {
      await onAddMultiple([
        {
          variantId: fallbackVariantId,
          quantity: fallbackQty,
          paymentMethod: fallbackPaymentMethod,
        },
      ]);
      handleClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-card border-border">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            {selectedProduct && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedProduct(null)}
                className="size-7 rounded-lg"
              >
                {locale === "ar" ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
            )}
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="size-5 text-primary" />
              {selectedProduct
                ? locale === "ar"
                  ? `${selectedProduct.nameAr} — اختر الكميات`
                  : `${selectedProduct.nameEn} — Select Quantities`
                : locale === "ar"
                  ? "إضافة منتج جديد للأوردر"
                  : "Add New Product to Order"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {selectedProduct
              ? hasColorSizeMatrix
                ? locale === "ar"
                  ? "حدد كمية كل مقاس ولون ترغب في إضافته مباشرة للأوردر الحالي."
                  : "Select quantity per color and size combination directly for this order."
                : locale === "ar"
                  ? "اختر المتغير والكمية للإضافة للأوردر."
                  : "Select variant and quantity to add to order."
              : locale === "ar"
                ? "ابحث عن المنتج بالاسم أو الكود لإضافته بنفس تفاصيل الشحن."
                : "Search products by name or SKU to add to current order."}
          </DialogDescription>
        </DialogHeader>

        {!selectedProduct ? (
          /* Step 1: Search & Pick Product */
          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  locale === "ar"
                    ? "ابحث باسم المنتج أو كود SKU..."
                    : "Search product name or SKU..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="ps-9 bg-background"
              />
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pe-1">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Package className="mx-auto size-8 opacity-40 mb-2" />
                  {locale === "ar" ? "لا توجد منتجات مطابقة للبحث." : "No matching products found."}
                </div>
              ) : (
                filteredProducts.map((prod) => {
                  const mData = extractMatrixFromVariants(prod.variants, prod.slug);
                  const isMatrix = mData.colors.length > 0 && mData.sizes.length > 0;
                  const totalStock = prod.variants.reduce((acc, v) => acc + (v.stock || 0), 0);

                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleSelectProduct(prod)}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/30 transition-all text-start group bg-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt=""
                            className="size-12 rounded-lg object-cover border shrink-0 bg-muted/20"
                          />
                        ) : (
                          <div className="size-12 rounded-lg bg-muted flex items-center justify-center border shrink-0">
                            <Package className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground truncate">
                              {locale === "ar" ? prod.nameAr : prod.nameEn}
                            </span>
                            {isMatrix && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 border-primary/40 text-primary"
                              >
                                {locale === "ar" ? "Matrix" : "Matrix"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {prod.slug}
                          </p>
                          <div className="flex items-center gap-2 pt-0.5 text-xs">
                            <span className="font-bold text-foreground">
                              {formatEGP(prod.cashPrice)}
                            </span>
                            {prod.pointsEnabled && prod.defaultPointsPrice && (
                              <span className="text-accent flex items-center gap-0.5 text-[11px]">
                                <Coins className="size-3" />
                                {formatPoints(prod.defaultPointsPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          {totalStock > 0
                            ? locale === "ar"
                              ? `${totalStock} متوفر`
                              : `${totalStock} in stock`
                            : locale === "ar"
                              ? "نفد"
                              : "Out of stock"}
                        </span>
                        <div className="size-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Plus className="size-4" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Selected Product Matrix or Fallback Selector */
          <div className="space-y-4 pt-1">
            {hasColorSizeMatrix ? (
              <CustomerQuantityMatrix
                variants={selectedProduct.variants}
                images={selectedProduct.images}
                pointsEnabled={selectedProduct.pointsEnabled}
                defaultCashPrice={selectedProduct.cashPrice}
                defaultPointsPrice={selectedProduct.defaultPointsPrice}
                busy={busy}
                ctaLabel={locale === "ar" ? "إضافة إلى الأوردر" : "Add to Order"}
                onAddSelected={async (selections) => {
                  setBusy(true);
                  try {
                    await onAddMultiple(
                      selections.map((s) => ({
                        variantId: s.variantId,
                        quantity: s.quantity,
                        paymentMethod: s.paymentMethod,
                      })),
                    );
                    handleClose();
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : (
              /* Fallback for single / non-color-size variants */
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">
                    {locale === "ar" ? "اختر المتغير:" : "Select Variant:"}
                  </label>
                  <select
                    value={fallbackVariantId}
                    onChange={(e) => setFallbackVariantId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {selectedProduct.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {locale === "ar" ? v.nameAr : v.nameEn} (SKU: {v.sku}) —{" "}
                        {formatEGP(v.cashPrice ?? selectedProduct.cashPrice)}
                        {v.stock <= 0 ? (locale === "ar" ? " - نفد" : " - Out") : ` (${v.stock})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground">
                      {locale === "ar" ? "الكمية:" : "Quantity:"}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={fallbackQty}
                      onChange={(e) => setFallbackQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground">
                      {locale === "ar" ? "طريقة الدفع:" : "Payment:"}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFallbackPaymentMethod("CASH")}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                          fallbackPaymentMethod === "CASH"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {locale === "ar" ? "كاش" : "Cash"}
                      </button>
                      <button
                        type="button"
                        disabled={!selectedProduct.pointsEnabled}
                        onClick={() => setFallbackPaymentMethod("POINTS")}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                          fallbackPaymentMethod === "POINTS"
                            ? "bg-accent text-accent-foreground border-accent"
                            : "border-border hover:bg-muted disabled:opacity-40"
                        }`}
                      >
                        {locale === "ar" ? "نقاط" : "Points"}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full font-bold h-10 gap-2 rounded-xl"
                  disabled={busy}
                  onClick={handleAddFallback}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {locale === "ar" ? "إضافة إلى الأوردر" : "Add to Order"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
