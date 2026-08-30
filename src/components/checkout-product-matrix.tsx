import { useMemo, useState } from "react";
import { Coins, Minus, Package, Plus, Trash2, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import type { CartItemView } from "@/lib/cart.functions";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog.functions";
import type { PaymentMethod } from "@/lib/points-rules";
import {
  extractMatrixFromVariants,
  findVariantForCell,
  getMatrixCellSummary,
} from "@/lib/variant-matrix";

interface CheckoutProductMatrixProps {
  productId: string;
  catalogProduct?: CatalogProduct | undefined;
  items: CartItemView[];
  busy: boolean;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onAddVariant: (variantId: string, quantity: number, paymentMethod: PaymentMethod) => void;
  onUpdatePaymentMethod?: (itemId: string, method: PaymentMethod) => void;
}

export function CheckoutProductMatrix({
  productId,
  catalogProduct,
  items,
  busy,
  onUpdateQuantity,
  onRemoveItem,
  onAddVariant,
  onUpdatePaymentMethod,
}: CheckoutProductMatrixProps) {
  const { locale, formatEGP, formatPoints } = useI18n();

  // All variants for this product
  const variants = useMemo<CatalogVariant[]>(() => {
    if (catalogProduct?.variants && catalogProduct.variants.length > 0) {
      return catalogProduct.variants;
    }
    // Fallback constructed from cart items
    return items.map((it) => ({
      id: it.variantId,
      sku: it.sku,
      nameEn: it.variantNameEn,
      nameAr: it.variantNameAr,
      cashPrice: it.unitCashPrice,
      pointsPrice: it.unitPointsPrice,
      stock: it.stock,
    }));
  }, [catalogProduct, items]);

  const matrix = useMemo(() => {
    return extractMatrixFromVariants(variants, catalogProduct?.slug ?? "prod");
  }, [variants, catalogProduct?.slug]);

  const productName =
    locale === "ar"
      ? (catalogProduct?.nameAr ?? items[0]?.productNameAr ?? "منتج")
      : (catalogProduct?.nameEn ?? items[0]?.productNameEn ?? "Product");

  const productImg = catalogProduct?.imageUrl ?? items[0]?.imageUrl ?? null;
  const pointsEnabled = catalogProduct?.pointsEnabled ?? items.some((i) => i.pointsEnabled);

  // Map variantId -> CartItemView for quick cell lookup
  const cartItemByVariantId = useMemo(() => {
    const map = new Map<string, CartItemView>();
    for (const item of items) {
      map.set(item.variantId, item);
    }
    return map;
  }, [items]);

  // Overall stats for this product in the cart
  const productTotalQty = useMemo(() => {
    return items.reduce((acc, it) => acc + it.quantity, 0);
  }, [items]);

  const productTotalCash = useMemo(() => {
    return items.reduce((acc, it) => acc + it.lineCashTotal, 0);
  }, [items]);

  const productTotalPoints = useMemo(() => {
    return items.reduce((acc, it) => acc + it.linePointsTotal, 0);
  }, [items]);

  // Calculate row totals (per color)
  const rowTotals = useMemo(() => {
    const map: Record<string, { qty: number; cash: number; points: number }> = {};
    for (const color of matrix.colors) {
      let qty = 0;
      let cash = 0;
      let points = 0;
      for (const size of matrix.sizes) {
        const v = findVariantForCell(variants, color, size);
        if (v) {
          const it = cartItemByVariantId.get(v.id);
          if (it) {
            qty += it.quantity;
            cash += it.lineCashTotal;
            points += it.linePointsTotal;
          }
        }
      }
      map[color] = { qty, cash, points };
    }
    return map;
  }, [matrix, variants, cartItemByVariantId]);

  // Calculate column totals (per size)
  const colTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const size of matrix.sizes) {
      let qty = 0;
      for (const color of matrix.colors) {
        const v = findVariantForCell(variants, color, size);
        if (v) {
          const it = cartItemByVariantId.get(v.id);
          if (it) {
            qty += it.quantity;
          }
        }
      }
      map[size] = qty;
    }
    return map;
  }, [matrix, variants, cartItemByVariantId]);

  const handleCellChange = (
    color: string,
    size: string,
    targetVariant: CatalogVariant | null,
    delta: number,
  ) => {
    if (!targetVariant || busy) return;
    const existingItem = cartItemByVariantId.get(targetVariant.id);
    const currentQty = existingItem?.quantity ?? 0;
    const nextQty = Math.max(0, Math.min(targetVariant.stock, currentQty + delta));

    if (nextQty === currentQty) return;

    if (nextQty === 0 && existingItem) {
      onRemoveItem(existingItem.id);
    } else if (existingItem) {
      onUpdateQuantity(existingItem.id, nextQty);
    } else if (nextQty > 0) {
      onAddVariant(targetVariant.id, nextQty, "CASH");
    }
  };

  const handleRemoveAllForProduct = () => {
    for (const it of items) {
      onRemoveItem(it.id);
    }
  };

  return (
    <Card className="overflow-hidden border border-border/80 bg-card shadow-xs rounded-xl">
      <CardContent className="p-4 space-y-4">
        {/* Product Group Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {productImg ? (
              <img
                src={productImg}
                alt={productName}
                className="size-14 rounded-lg object-cover border shrink-0 bg-muted/20"
              />
            ) : (
              <div className="size-14 rounded-lg bg-muted flex items-center justify-center border shrink-0">
                <Package className="size-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-foreground truncate">{productName}</h4>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                  {items.length} {locale === "ar" ? "متغيّرات" : "variants"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {locale === "ar" ? `إجمالي المنتج:` : `Product Total:`}{" "}
                  <span className="text-primary font-bold">
                    {productTotalQty} {locale === "ar" ? "قطع" : "pcs"}
                  </span>
                </span>
                <span>•</span>
                <span className="font-bold text-foreground">{formatEGP(productTotalCash)}</span>
                {productTotalPoints > 0 && (
                  <span className="text-accent font-semibold flex items-center gap-1">
                    <Coins className="size-3" />
                    {formatPoints(productTotalPoints)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-8 px-2.5 rounded-lg gap-1 shrink-0"
            disabled={busy}
            onClick={handleRemoveAllForProduct}
          >
            <Trash2 className="size-3.5" />
            <span>{locale === "ar" ? "حذف المنتج" : "Remove All"}</span>
          </Button>
        </div>

        <Separator />

        {/* Matrix View Header / Hint */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Layers className="size-3.5 text-primary" />
            <span>
              {locale === "ar"
                ? "ماتريكس الألوان × المقاسات (عدّل الكمية مباشرة):"
                : "Color × Size Matrix (Adjust quantities directly):"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground/80 sm:hidden">
            {locale === "ar" ? "اسحب أفقياً لرؤية المقاسات ←" : "Scroll horizontally →"}
          </span>
        </div>

        {/* The Matrix Table */}
        <div className="overflow-x-auto rounded-lg border border-border/70 bg-muted/10">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40">
                <th className="sticky start-0 z-10 bg-muted/40 p-2.5 text-start font-bold text-foreground min-w-[100px]">
                  {locale === "ar" ? "اللون / المقاس" : "Color / Size"}
                </th>
                {matrix.sizes.map((size) => (
                  <th
                    key={size}
                    className="p-2.5 text-center font-bold text-foreground min-w-[80px]"
                  >
                    {size}
                  </th>
                ))}
                <th className="p-2.5 text-center font-bold text-foreground bg-muted/30 min-w-[75px]">
                  {locale === "ar" ? "إجمالي اللون" : "Row Total"}
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.colors.map((color) => {
                const rowStat = rowTotals[color] || { qty: 0, cash: 0, points: 0 };
                return (
                  <tr
                    key={color}
                    className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    {/* Row Header (Color) */}
                    <td className="sticky start-0 z-10 bg-background/95 p-2.5 font-bold text-foreground border-e border-border/40">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{color}</span>
                      </div>
                    </td>

                    {/* Matrix Cells */}
                    {matrix.sizes.map((size) => {
                      const cellVariant = findVariantForCell(variants, color, size);
                      const cartItem = cellVariant
                        ? cartItemByVariantId.get(cellVariant.id)
                        : undefined;
                      const cellQty = cartItem?.quantity ?? 0;
                      const isUnavailable = !cellVariant;
                      const isOutOfStock = Boolean(cellVariant && cellVariant.stock <= 0);

                      if (isUnavailable) {
                        return (
                          <td
                            key={size}
                            className="p-1.5 text-center text-[10px] text-muted-foreground/40 bg-muted/20"
                          >
                            {locale === "ar" ? "غير متاح" : "N/A"}
                          </td>
                        );
                      }

                      if (isOutOfStock) {
                        return (
                          <td
                            key={size}
                            className="p-1.5 text-center text-[10px] text-destructive font-medium bg-destructive/5"
                          >
                            {locale === "ar" ? "نفد" : "Out"}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={size}
                          className={`p-1.5 text-center ${cellQty > 0 ? "bg-primary/5" : ""}`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={busy || cellQty <= 0}
                              onClick={() => handleCellChange(color, size, cellVariant, -1)}
                              className="size-6 rounded text-xs p-0 h-6 w-6"
                            >
                              <Minus className="size-2.5" />
                            </Button>

                            <span
                              className={`w-6 text-center font-bold text-xs ${
                                cellQty > 0 ? "text-primary" : "text-muted-foreground"
                              }`}
                            >
                              {cellQty}
                            </span>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={busy || cellQty >= cellVariant.stock}
                              onClick={() => handleCellChange(color, size, cellVariant, 1)}
                              className="size-6 rounded text-xs p-0 h-6 w-6"
                            >
                              <Plus className="size-2.5" />
                            </Button>
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {locale === "ar"
                              ? `مخزون: ${cellVariant.stock}`
                              : `Stock: ${cellVariant.stock}`}
                          </div>
                        </td>
                      );
                    })}

                    {/* Row Total */}
                    <td className="p-2 text-center font-bold bg-muted/20 border-s border-border/40">
                      <span
                        className={
                          rowStat.qty > 0 ? "text-foreground font-black" : "text-muted-foreground"
                        }
                      >
                        {rowStat.qty}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-bold border-t border-border/70">
                <td className="sticky start-0 z-10 bg-muted/60 p-2.5 text-start font-bold text-foreground">
                  {locale === "ar" ? "إجمالي المقاس" : "Column Total"}
                </td>
                {matrix.sizes.map((size) => (
                  <td key={size} className="p-2 text-center font-black text-foreground">
                    {colTotals[size] || 0}
                  </td>
                ))}
                <td className="p-2 text-center font-black text-primary bg-primary/10 border-s border-border/60">
                  {productTotalQty}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Compact Individual Items List with Payment Method switchers if needed */}
        {items.length > 0 && onUpdatePaymentMethod && pointsEnabled && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {locale === "ar"
                ? "طرق دفع المتغيّرات المحددة:"
                : "Selected Variants Payment Methods:"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {it.variantNameAr || it.variantNameEn}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {it.quantity} × {formatEGP(it.unitCashPrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdatePaymentMethod(it.id, "CASH")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        it.paymentMethod === "CASH"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {locale === "ar" ? "كاش" : "Cash"}
                    </button>
                    <button
                      type="button"
                      disabled={!it.pointsEnabled || !it.unitPointsPrice}
                      onClick={() => onUpdatePaymentMethod(it.id, "POINTS")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${
                        it.paymentMethod === "POINTS"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40"
                      }`}
                    >
                      <Coins className="size-2.5" />
                      {locale === "ar" ? "نقاط" : "Points"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
