import { useState, useMemo } from "react";
import { Boxes, Check, Minus, Package, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { CatalogVariant } from "@/lib/catalog.functions";
import type { MediaImage } from "@/lib/variant-media";
import type { PaymentMethod } from "@/lib/points-rules";
import {
  extractMatrixFromVariants,
  parseVariantColorAndSize,
  type MatrixCell,
} from "@/lib/variant-matrix";

export interface CustomerMatrixItemSelection {
  variantId: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  unitCashPrice: number;
  unitPointsPrice: number | null;
}

interface CustomerQuantityMatrixProps {
  variants: CatalogVariant[];
  images?: MediaImage[];
  pointsEnabled: boolean;
  defaultCashPrice: number;
  defaultPointsPrice: number | null;
  busy?: boolean;
  ctaLabel?: string;
  onAddSelected: (selections: CustomerMatrixItemSelection[]) => Promise<void> | void;
}

export function CustomerQuantityMatrix({
  variants,
  images = [],
  pointsEnabled,
  defaultCashPrice,
  defaultPointsPrice,
  busy = false,
  ctaLabel,
  onAddSelected,
}: CustomerQuantityMatrixProps) {
  const { locale, formatEGP, formatPoints } = useI18n();

  // Parse color & size dimensions from catalog variants
  const { colors, sizes, variantLookup } = useMemo(() => {
    const colorSet = new Set<string>();
    const sizeSet = new Set<string>();
    const lookup = new Map<string, CatalogVariant>();

    for (const v of variants) {
      const parsed = parseVariantColorAndSize(v.nameAr, v.nameEn);
      if (parsed) {
        colorSet.add(parsed.color.trim());
        sizeSet.add(parsed.size.trim());
        lookup.set(`${parsed.color.trim()}__${parsed.size.trim()}`, v);
      }
    }

    return {
      colors: Array.from(colorSet),
      sizes: Array.from(sizeSet),
      variantLookup: lookup,
    };
  }, [variants]);

  // Selected quantities map: { variantId: quantity }
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");

  // Quantity handlers
  const handleSetQuantity = (variantId: string, maxStock: number, newQty: number) => {
    const clamped = Math.max(0, Math.min(maxStock, Math.floor(newQty || 0)));
    setQuantities((prev) => {
      if (clamped <= 0) {
        const next = { ...prev };
        delete next[variantId];
        return next;
      }
      return { ...prev, [variantId]: clamped };
    });
  };

  const handleIncrement = (variantId: string, maxStock: number) => {
    const current = quantities[variantId] || 0;
    if (current < maxStock) {
      handleSetQuantity(variantId, maxStock, current + 1);
    }
  };

  const handleDecrement = (variantId: string, maxStock: number) => {
    const current = quantities[variantId] || 0;
    if (current > 0) {
      handleSetQuantity(variantId, maxStock, current - 1);
    }
  };

  // Live Totals
  const { totalPieces, totalCash, totalPoints, activeSelections } = useMemo(() => {
    let pieces = 0;
    let cash = 0;
    let points = 0;
    const selections: CustomerMatrixItemSelection[] = [];

    for (const [vId, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue;
      const variant = variants.find((v) => v.id === vId);
      if (!variant) continue;

      const unitCash = variant.cashPrice ?? defaultCashPrice;
      const unitPts = variant.pointsPrice ?? defaultPointsPrice;

      pieces += qty;
      cash += unitCash * qty;
      if (unitPts) {
        points += unitPts * qty;
      }

      selections.push({
        variantId: variant.id,
        sku: variant.sku,
        nameAr: variant.nameAr,
        nameEn: variant.nameEn,
        quantity: qty,
        paymentMethod,
        unitCashPrice: unitCash,
        unitPointsPrice: unitPts,
      });
    }

    return {
      totalPieces: pieces,
      totalCash: cash,
      totalPoints: points,
      activeSelections: selections,
    };
  }, [quantities, variants, defaultCashPrice, defaultPointsPrice, paymentMethod]);

  // Calculate row total chosen pieces for a specific color
  const getRowChosenPieces = (color: string) => {
    let sum = 0;
    for (const size of sizes) {
      const v = variantLookup.get(`${color.trim()}__${size.trim()}`);
      if (v && quantities[v.id]) {
        sum += quantities[v.id]!;
      }
    }
    return sum;
  };

  // Calculate column total chosen pieces for a specific size
  const getColumnChosenPieces = (size: string) => {
    let sum = 0;
    for (const color of colors) {
      const v = variantLookup.get(`${color.trim()}__${size.trim()}`);
      if (v && quantities[v.id]) {
        sum += quantities[v.id]!;
      }
    }
    return sum;
  };

  const handleAddAll = async () => {
    if (activeSelections.length === 0 || busy) return;
    await onAddSelected(activeSelections);
  };

  // Fallback if not a Color × Size structure
  if (colors.length === 0 || sizes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with Title and Payment Method Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/20">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-accent" />
          <span className="font-bold text-xs sm:text-sm text-foreground">
            {locale === "ar"
              ? "حدد الكمية المطلوبة لكل لون ومقاس"
              : "Select Quantity per Color & Size"}
          </span>
        </div>

        {/* Payment mode switcher */}
        {pointsEnabled && (defaultPointsPrice ?? 0) > 0 ? (
          <div className="flex items-center gap-1.5 bg-card p-1 rounded-lg border border-border">
            <span className="text-[11px] font-semibold text-muted-foreground px-1">
              {locale === "ar" ? "طريقة الدفع:" : "Payment:"}
            </span>
            <div className="flex rounded-md bg-muted/50 p-0.5">
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-xs font-bold transition-all ${
                  paymentMethod === "CASH"
                    ? "bg-background shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPaymentMethod("CASH")}
              >
                {locale === "ar" ? "كاش (EGP)" : "Cash"}
              </button>
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-xs font-bold transition-all ${
                  paymentMethod === "POINTS"
                    ? "bg-background shadow-xs text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPaymentMethod("POINTS")}
              >
                {locale === "ar" ? "نقاط (Points)" : "Points"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* The Interactive Matrix Table with Sticky Headers & Scroll */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full text-xs text-start border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="p-3 font-bold text-foreground text-start sticky start-0 bg-muted/95 backdrop-blur z-10 min-w-[110px]">
                {locale === "ar" ? "اللون / المقاس" : "Color / Size"}
              </th>
              {sizes.map((size) => (
                <th key={size} className="p-3 font-bold text-center text-foreground min-w-[105px]">
                  {size}
                </th>
              ))}
              <th className="p-3 font-bold text-center text-foreground bg-muted/80 min-w-[85px]">
                {locale === "ar" ? "المحدد" : "Chosen"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {colors.map((color) => {
              const rowChosen = getRowChosenPieces(color);
              return (
                <tr key={color} className="hover:bg-muted/10 transition">
                  {/* Sticky Color Label */}
                  <td className="p-3 font-bold text-foreground text-start sticky start-0 bg-card/95 backdrop-blur z-10 border-e border-border/40">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-accent shrink-0" />
                      <span className="truncate">{color}</span>
                    </div>
                  </td>

                  {/* Size cells */}
                  {sizes.map((size) => {
                    const variant = variantLookup.get(`${color.trim()}__${size.trim()}`);

                    if (!variant) {
                      return (
                        <td key={size} className="p-2 text-center">
                          <span className="text-[10px] text-muted-foreground/60">
                            {locale === "ar" ? "غير متاح" : "Unavailable"}
                          </span>
                        </td>
                      );
                    }

                    const stock = variant.stock;
                    const isOutOfStock = stock <= 0;
                    const currentQty = quantities[variant.id] || 0;

                    return (
                      <td key={size} className="p-2 text-center">
                        <div
                          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition ${
                            currentQty > 0
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/60 bg-background/50 hover:border-border"
                          }`}
                        >
                          {isOutOfStock ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-6 px-2 text-destructive border-destructive/30 bg-destructive/5 font-semibold"
                            >
                              {locale === "ar" ? "نفد" : "Out of stock"}
                            </Badge>
                          ) : (
                            <div className="flex items-center rounded-md border border-input bg-background h-7 shadow-2xs">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 h-6 w-6 rounded-none rounded-s-md"
                                disabled={busy || currentQty <= 0}
                                onClick={() => handleDecrement(variant.id, stock)}
                              >
                                <Minus className="size-2.5" />
                              </Button>
                              <input
                                type="number"
                                min="0"
                                max={stock}
                                value={currentQty || ""}
                                placeholder="0"
                                disabled={busy}
                                onChange={(e) =>
                                  handleSetQuantity(
                                    variant.id,
                                    stock,
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="w-8 text-center text-xs font-bold bg-transparent focus:outline-none"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 h-6 w-6 rounded-none rounded-e-md"
                                disabled={busy || currentQty >= stock}
                                onClick={() => handleIncrement(variant.id, stock)}
                              >
                                <Plus className="size-2.5" />
                              </Button>
                            </div>
                          )}

                          {/* Mini stock info */}
                          {!isOutOfStock && (
                            <span
                              className={`text-[9px] ${
                                stock <= 3
                                  ? "text-amber-500 font-semibold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {locale === "ar" ? `متاح: ${stock}` : `Stock: ${stock}`}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Row Total Selected Pieces */}
                  <td className="p-3 text-center font-bold text-xs text-foreground bg-muted/20">
                    <span
                      className={rowChosen > 0 ? "text-accent font-black" : "text-muted-foreground"}
                    >
                      {rowChosen}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer Column Totals & Grand Total */}
          <tfoot>
            <tr className="bg-muted/70 border-t-2 border-border font-bold">
              <td className="p-3 text-start sticky start-0 bg-muted/95 backdrop-blur z-10">
                {locale === "ar" ? "المجموع بالمقاس" : "Size Subtotal"}
              </td>
              {sizes.map((size) => {
                const colChosen = getColumnChosenPieces(size);
                return (
                  <td key={size} className="p-3 text-center text-xs font-bold text-foreground">
                    <span className={colChosen > 0 ? "text-accent" : "text-muted-foreground"}>
                      {colChosen}
                    </span>
                  </td>
                );
              })}
              <td className="p-3 text-center text-xs font-black text-accent bg-accent/10">
                {totalPieces}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Floating / Sticky Order Bar when items are selected */}
      <div className="p-4 rounded-xl border border-primary/30 bg-card shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {totalPieces}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                {locale === "ar"
                  ? `إجمالي القطع المحددة: ${totalPieces} قطعة`
                  : `Selected Pieces: ${totalPieces} items`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {locale === "ar"
                  ? "سيتم إضافة جميع المقاسات والألوان المحددة معاً إلى الطلب"
                  : "All selected sizes and colors will be added together to your order"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Price Preview */}
          <div className="text-end">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              {locale === "ar" ? "الإجمالي المطلوب" : "Total Amount"}
            </span>
            <span className="text-base font-black text-foreground">
              {paymentMethod === "POINTS" && totalPoints > 0
                ? formatPoints(totalPoints)
                : formatEGP(totalCash)}
            </span>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={totalPieces === 0 || busy}
            onClick={handleAddAll}
            className="h-11 px-6 font-bold text-sm rounded-xl shadow-md gap-2"
          >
            <ShoppingBag className="size-4" />
            <span>
              {ctaLabel ||
                (locale === "ar"
                  ? `إضافة للأوردر (${totalPieces})`
                  : `Add to Order (${totalPieces})`)}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
