import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Boxes,
  Check,
  Edit,
  Loader2,
  Minus,
  PackageCheck,
  PackageX,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { listAdminProducts } from "@/lib/admin-products.functions";
import { adjustVariantStock } from "@/lib/admin-operations.functions";

export function AdminInventoryTab() {
  const { locale, formatEGP } = useI18n();
  const queryClient = useQueryClient();

  const fetchAdminProducts = useServerFn(listAdminProducts);
  const adjustStockFn = useServerFn(adjustVariantStock);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => fetchAdminProducts(),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "OUT">("ALL");

  const [adjustDialog, setAdjustDialog] = useState<{
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    currentStock: number;
    newStock: number;
    reason: string;
  } | null>(null);

  const [busy, setBusy] = useState(false);

  // Flatten all variants with their parent product info
  const variantRows = useMemo(() => {
    const rows: {
      productId: string;
      productNameAr: string;
      productNameEn: string;
      categoryNameAr?: string | null;
      variantId: string;
      sku: string;
      variantNameAr: string;
      variantNameEn: string;
      cashPrice: number;
      pointsPrice: number | null;
      stock: number;
      isActive: boolean;
    }[] = [];

    for (const p of data?.products ?? []) {
      for (const v of p.variants) {
        rows.push({
          productId: p.id,
          productNameAr: p.nameAr,
          productNameEn: p.nameEn,
          categoryNameAr: p.categoryNameAr,
          variantId: v.id,
          sku: v.sku,
          variantNameAr: v.nameAr,
          variantNameEn: v.nameEn,
          cashPrice: v.cashPrice ?? p.cashPrice,
          pointsPrice: v.pointsPrice ?? p.defaultPointsPrice,
          stock: v.stock,
          isActive: v.isActive && p.isActive,
        });
      }
    }
    return rows;
  }, [data?.products]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return variantRows.filter((row) => {
      // Stock filter
      if (stockFilter === "LOW" && (row.stock > 5 || row.stock === 0)) return false;
      if (stockFilter === "OUT" && row.stock > 0) return false;

      // Query filter
      if (!q) return true;
      return (
        row.sku.toLowerCase().includes(q) ||
        row.productNameAr.toLowerCase().includes(q) ||
        row.productNameEn.toLowerCase().includes(q) ||
        row.variantNameAr.toLowerCase().includes(q)
      );
    });
  }, [variantRows, searchTerm, stockFilter]);

  const lowStockTotal = variantRows.filter((r) => r.stock <= 5 && r.stock > 0).length;
  const outOfStockTotal = variantRows.filter((r) => r.stock === 0).length;

  const handleOpenAdjust = (row: (typeof variantRows)[0]) => {
    setAdjustDialog({
      variantId: row.variantId,
      productName: locale === "ar" ? row.productNameAr : row.productNameEn,
      variantName: locale === "ar" ? row.variantNameAr : row.variantNameEn,
      sku: row.sku,
      currentStock: row.stock,
      newStock: row.stock,
      reason: "تعديل جرد يدوي",
    });
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustDialog) return;

    setBusy(true);
    try {
      await adjustStockFn({
        data: {
          variantId: adjustDialog.variantId,
          newStock: adjustDialog.newStock,
          reason: adjustDialog.reason,
        },
      });

      toast.success(
        locale === "ar"
          ? `تم تعديل مخزون ${adjustDialog.sku} إلى ${adjustDialog.newStock} قطعة`
          : `Updated stock for ${adjustDialog.sku} to ${adjustDialog.newStock}`,
      );
      setAdjustDialog(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-payload"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    } finally {
      setBusy(false);
    }
  };

  const handleQuickDelta = async (variantId: string, current: number, delta: number) => {
    const nextStock = Math.max(0, current + delta);
    try {
      await adjustStockFn({
        data: {
          variantId,
          newStock: nextStock,
          reason: `Quick ${delta > 0 ? "+" : ""}${delta}`,
        },
      });
      toast.success(
        locale === "ar" ? `تم تحديث المخزون: ${nextStock}` : `Stock updated: ${nextStock}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-payload"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust stock");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Summary Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {locale === "ar" ? "إدارة ومراقبة المخزون" : "Inventory & Stock Matrix"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "متابعة الكميات المتاحة لكل متغير وتعديل المخزون الفوري بنقرة واحدة."
              : "Track variant stock levels and make instant adjustments."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 rounded-xl text-xs"
          >
            <RefreshCw className="size-3.5" />
            {locale === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          onClick={() => setStockFilter("ALL")}
          className={`rounded-xl border cursor-pointer transition ${
            stockFilter === "ALL" ? "border-primary bg-primary/5" : "border-border/80"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block">
                {locale === "ar" ? "إجمالي المتغيرات" : "Total Variants"}
              </span>
              <span className="text-2xl font-black">{variantRows.length}</span>
            </div>
            <Boxes className="size-7 text-primary opacity-80" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStockFilter("LOW")}
          className={`rounded-xl border cursor-pointer transition ${
            stockFilter === "LOW" ? "border-amber-500 bg-amber-500/10" : "border-border/80"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block">
                {locale === "ar" ? "مخزون منخفض (≤ 5)" : "Low Stock (≤ 5)"}
              </span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {lowStockTotal}
              </span>
            </div>
            <AlertTriangle className="size-7 text-amber-500 opacity-80" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStockFilter("OUT")}
          className={`rounded-xl border cursor-pointer transition ${
            stockFilter === "OUT" ? "border-destructive bg-destructive/10" : "border-border/80"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-destructive font-semibold block">
                {locale === "ar" ? "نفد من المخزون (0)" : "Out of Stock (0)"}
              </span>
              <span className="text-2xl font-black text-destructive">{outOfStockTotal}</span>
            </div>
            <PackageX className="size-7 text-destructive opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            locale === "ar"
              ? "ابحث بكود المتغير (SKU) أو اسم المنتج..."
              : "Search by SKU or product name..."
          }
          className="ps-10 h-11 rounded-xl text-sm border-border bg-card"
        />
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl">
          {locale === "ar" ? "لا توجد نتائج مطابقة" : "No matching inventory items"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
          <table className="w-full text-xs text-start">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{locale === "ar" ? "كود SKU" : "SKU"}</th>
                <th className="p-3 text-start">{locale === "ar" ? "المنتج" : "Product"}</th>
                <th className="p-3 text-start">
                  {locale === "ar" ? "المتغير / الخاصية" : "Variant"}
                </th>
                <th className="p-3 text-start">{locale === "ar" ? "السعر" : "Price"}</th>
                <th className="p-3 text-center">{locale === "ar" ? "الكمية الحالية" : "Stock"}</th>
                <th className="p-3 text-center">
                  {locale === "ar" ? "تعديل سريع" : "Quick Adjust"}
                </th>
                <th className="p-3 text-end">{locale === "ar" ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.map((row) => {
                const isOut = row.stock === 0;
                const isLow = row.stock > 0 && row.stock <= 5;

                return (
                  <tr key={row.variantId} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-bold text-foreground">{row.sku}</td>
                    <td className="p-3 font-medium">
                      {locale === "ar" ? row.productNameAr : row.productNameEn}
                      {row.categoryNameAr && (
                        <span className="block text-[10px] text-muted-foreground">
                          {row.categoryNameAr}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {locale === "ar" ? row.variantNameAr : row.variantNameEn}
                    </td>
                    <td className="p-3 font-medium">{formatEGP(row.cashPrice)}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={isOut ? "destructive" : isLow ? "secondary" : "outline"}
                        className={`font-bold px-2.5 py-0.5 ${
                          isLow
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : ""
                        }`}
                      >
                        {row.stock} {locale === "ar" ? "قطعة" : "units"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={row.stock <= 0}
                          onClick={() => handleQuickDelta(row.variantId, row.stock, -1)}
                          className="size-7 rounded-lg"
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleQuickDelta(row.variantId, row.stock, 1)}
                          className="size-7 rounded-lg"
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 text-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAdjust(row)}
                        className="h-8 px-2.5 text-xs font-semibold gap-1"
                      >
                        <Edit className="size-3.5" />
                        {locale === "ar" ? "تعديل دقيق" : "Adjust"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Precise Stock Adjustment Dialog */}
      <Dialog open={Boolean(adjustDialog)} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "تعديل كمية المخزون" : "Adjust Variant Stock"}
            </DialogTitle>
            <DialogDescription>
              {adjustDialog?.productName} — {adjustDialog?.variantName} ({adjustDialog?.sku})
            </DialogDescription>
          </DialogHeader>

          {adjustDialog && (
            <form onSubmit={handleSaveStock} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-xs text-muted-foreground block">
                    {locale === "ar" ? "المخزون الحالي" : "Current Stock"}
                  </span>
                  <span className="text-xl font-bold">{adjustDialog.currentStock}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-stock">
                    {locale === "ar" ? "الكمية الجديدة *" : "New Stock *"}
                  </Label>
                  <Input
                    id="new-stock"
                    type="number"
                    min="0"
                    required
                    value={adjustDialog.newStock}
                    onChange={(e) =>
                      setAdjustDialog((prev) =>
                        prev
                          ? { ...prev, newStock: Math.max(0, parseInt(e.target.value) || 0) }
                          : null,
                      )
                    }
                    className="h-12 text-lg font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-reason">
                  {locale === "ar" ? "سبب التعديل / ملاحظات الجرد" : "Reason / Notes"}
                </Label>
                <Input
                  id="stock-reason"
                  value={adjustDialog.reason}
                  onChange={(e) =>
                    setAdjustDialog((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                  }
                  placeholder="مثال: وصول شحنة جديدة أو تصحيح جرد"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustDialog(null)}
                  disabled={busy}
                >
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={busy} className="gap-1.5">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {locale === "ar" ? "حفظ التعديل" : "Confirm Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
