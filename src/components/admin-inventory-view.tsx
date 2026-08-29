import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Boxes,
  Check,
  Grid3X3,
  List,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import type { AdminProductRow } from "@/lib/admin-product-rules";
import { updateAdminVariantStock } from "@/lib/admin-products.functions";

type AdminInventoryViewProps = {
  products: AdminProductRow[];
  onRefresh: () => void;
};

type StockReason = "NEW_SHIPMENT" | "STOCK_AUDIT" | "DAMAGED" | "CUSTOMER_RETURN" | "OTHER";

export function AdminInventoryView({ products, onRefresh }: AdminInventoryViewProps) {
  const { formatEGP, locale } = useI18n();
  const queryClient = useQueryClient();
  const updateStockFn = useServerFn(updateAdminVariantStock);

  const [activeSubTab, setActiveSubTab] = useState<"list" | "matrix">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id ?? "");

  // Local state for stock adjustments in flight
  const [adjustingStock, setAdjustingStock] = useState<Record<string, number>>({});
  const [adjustmentReason, setAdjustmentReason] = useState<Record<string, StockReason>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

  // Flatten all variants across all products for list view
  const allFlattenedVariants = useMemo(() => {
    const list: {
      productId: string;
      productName: string;
      categoryName: string;
      productImage: string | null;
      variantId: string;
      sku: string;
      variantName: string;
      stock: number;
      cashPrice: number | null;
      isActive: boolean;
    }[] = [];

    for (const p of products) {
      for (const v of p.variants) {
        list.push({
          productId: p.id,
          productName: locale === "ar" ? p.nameAr : p.nameEn,
          categoryName:
            (locale === "ar" ? p.categoryNameAr : p.categoryNameEn) ||
            (locale === "ar" ? "بدون تصنيف" : "Uncategorized"),
          productImage: p.imageUrl,
          variantId: v.id,
          sku: v.sku,
          variantName: locale === "ar" ? v.nameAr : v.nameEn,
          stock: v.stock,
          cashPrice: v.cashPrice ?? p.cashPrice,
          isActive: v.isActive && p.isActive,
        });
      }
    }
    return list;
  }, [products, locale]);

  const filteredVariants = useMemo(() => {
    return allFlattenedVariants.filter((item) => {
      const matchesSearch =
        searchTerm.trim() === "" ||
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat =
        selectedCategoryFilter === "ALL" || item.categoryName === selectedCategoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [allFlattenedVariants, searchTerm, selectedCategoryFilter]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of allFlattenedVariants) {
      if (item.categoryName) set.add(item.categoryName);
    }
    return Array.from(set);
  }, [allFlattenedVariants]);

  const updateMutation = useMutation({
    mutationFn: (vars: { variantId: string; newStock: number; reason?: string }) =>
      updateStockFn({ data: vars }),
    onSuccess: (_, vars) => {
      toast.success(locale === "ar" ? "تم تحديث المخزون بنجاح" : "Stock updated successfully");
      setIsSaving((prev) => ({ ...prev, [vars.variantId]: false }));
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (err, vars) => {
      setIsSaving((prev) => ({ ...prev, [vars.variantId]: false }));
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    },
  });

  const handleApplyStock = (variantId: string, currentStock: number) => {
    const pendingStock = adjustingStock[variantId];
    if (pendingStock === undefined || pendingStock === currentStock) {
      return;
    }
    if (pendingStock < 0) {
      toast.error(locale === "ar" ? "المخزون لا يمكن أن يكون سالبًا" : "Stock cannot be negative");
      return;
    }

    const reason = adjustmentReason[variantId] || "STOCK_AUDIT";
    setIsSaving((prev) => ({ ...prev, [variantId]: true }));
    updateMutation.mutate({
      variantId,
      newStock: pendingStock,
      reason,
    });
  };

  const handleDelta = (variantId: string, currentStock: number, delta: number) => {
    const existing = adjustingStock[variantId] ?? currentStock;
    const nextVal = Math.max(0, existing + delta);
    setAdjustingStock((prev) => ({ ...prev, [variantId]: nextVal }));
  };

  // Matrix Analysis for selected product
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const parsedMatrix = useMemo(() => {
    if (!selectedProduct || selectedProduct.variants.length === 0) return null;

    // Try parsing variants into 2 dimensions: (Color / Row) x (Size / Col)
    // Common separators: " / ", "-", " | ", ",", " "
    type VariantCell = {
      variant: (typeof selectedProduct.variants)[0];
      rowKey: string;
      colKey: string;
    };

    const rowKeys = new Set<string>();
    const colKeys = new Set<string>();
    const cells: VariantCell[] = [];

    for (const v of selectedProduct.variants) {
      const name = (locale === "ar" ? v.nameAr : v.nameEn).trim();
      let row = name;
      let col = "قياسي";

      if (name.includes("/")) {
        const parts = name.split("/").map((s) => s.trim());
        row = parts[0] || name;
        col = parts[1] || "1";
      } else if (name.includes("-")) {
        const parts = name.split("-").map((s) => s.trim());
        row = parts[0] || name;
        col = parts[1] || "1";
      } else if (name.includes(" ")) {
        const parts = name.split(" ").map((s) => s.trim());
        row = parts[0] || name;
        col = parts.slice(1).join(" ") || "1";
      }

      rowKeys.add(row);
      colKeys.add(col);
      cells.push({ variant: v, rowKey: row, colKey: col });
    }

    const rows = Array.from(rowKeys);
    const cols = Array.from(colKeys);

    // If there's only 1 row or 1 col and >1 variants, treat row as each variant
    if (rows.length === 1 && cols.length === 1 && selectedProduct.variants.length > 1) {
      return {
        isMatrixCompatible: false,
        variants: selectedProduct.variants,
      };
    }

    const grid = new Map<string, (typeof selectedProduct.variants)[0]>();
    for (const c of cells) {
      grid.set(`${c.rowKey}:::${c.colKey}`, c.variant);
    }

    return {
      isMatrixCompatible: true,
      rows,
      cols,
      grid,
      variants: selectedProduct.variants,
    };
  }, [selectedProduct, locale]);

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {locale === "ar" ? "إدارة المخزون والمصفوفة" : "Inventory & Variant Matrix"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {locale === "ar"
              ? "تعديل كميات المخزون مباشرة، تسجيل أسباب التعديل، ومصفوفة المتغيرات التفاعلية."
              : "Real-time stock adjustments, reason logging, and interactive multi-attribute matrix."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 text-xs">
            <RefreshCw className="size-3.5" />
            {locale === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeSubTab}
        onValueChange={(val) => setActiveSubTab(val as "list" | "matrix")}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list" className="gap-2 text-xs">
            <List className="size-3.5" />
            {locale === "ar" ? "جدول المخزون الكامل" : "Inventory List"}
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-2 text-xs">
            <Grid3X3 className="size-3.5" />
            {locale === "ar" ? "مصفوفة المتغيرات 2D" : "2D Matrix View"}
          </TabsTrigger>
        </TabsList>

        {/* ================= Tab 1: Full Inventory List ================= */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  locale === "ar"
                    ? "بحث بالمنتج، المتغير، أو رمز SKU..."
                    : "Search by product, variant, or SKU..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue placeholder={locale === "ar" ? "كل التصنيفات" : "All Categories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {locale === "ar" ? "كل التصنيفات" : "All Categories"}
                  </SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variants Table Card */}
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-border bg-muted/40 font-bold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-start">
                        {locale === "ar" ? "المنتج / المتغير" : "Product / Variant"}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {locale === "ar" ? "رمز SKU" : "SKU"}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {locale === "ar" ? "السعر" : "Price"}
                      </th>
                      <th className="px-3 py-3 text-center">
                        {locale === "ar" ? "المخزون الحالي" : "Current Stock"}
                      </th>
                      <th className="px-3 py-3 text-center">
                        {locale === "ar" ? "تعديل الكمية" : "Adjust Quantity"}
                      </th>
                      <th className="px-3 py-3 text-start">
                        {locale === "ar" ? "سبب التعديل" : "Reason"}
                      </th>
                      <th className="px-4 py-3 text-center">
                        {locale === "ar" ? "الإجراء" : "Action"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredVariants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          <Boxes className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                          <p>{locale === "ar" ? "لا توجد متغيرات مطابقة" : "No variants found"}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredVariants.map((item) => {
                        const targetStock = adjustingStock[item.variantId] ?? item.stock;
                        const hasChange = targetStock !== item.stock;
                        const isLowStock = item.stock <= 5;
                        const isSavingItem = isSaving[item.variantId] || false;

                        return (
                          <tr
                            key={item.variantId}
                            className={`transition-colors hover:bg-muted/10 ${
                              isLowStock ? "bg-amber-500/5" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {item.productImage ? (
                                  <img
                                    src={item.productImage}
                                    alt=""
                                    className="size-8 rounded object-cover border"
                                  />
                                ) : (
                                  <div className="flex size-8 items-center justify-center rounded border bg-muted">
                                    <Boxes className="size-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-foreground">
                                    {item.productName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {item.variantName} • {item.categoryName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono font-bold text-muted-foreground">
                              {item.sku}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {item.cashPrice ? formatEGP(item.cashPrice) : "-"}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="font-mono font-bold text-sm text-foreground">
                                  {item.stock}
                                </span>
                                {isLowStock ? (
                                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                    {item.stock === 0
                                      ? locale === "ar"
                                        ? "نفد"
                                        : "Zero"
                                      : locale === "ar"
                                        ? "منخفض"
                                        : "Low"}
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => handleDelta(item.variantId, item.stock, -1)}
                                >
                                  <Minus className="size-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  value={targetStock}
                                  onChange={(e) =>
                                    setAdjustingStock((prev) => ({
                                      ...prev,
                                      [item.variantId]: Math.max(0, Number(e.target.value)),
                                    }))
                                  }
                                  className={`h-7 w-16 text-center font-mono text-xs font-bold ${
                                    hasChange ? "border-primary ring-1 ring-primary/30" : ""
                                  }`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => handleDelta(item.variantId, item.stock, 1)}
                                >
                                  <Plus className="size-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Select
                                value={adjustmentReason[item.variantId] || "STOCK_AUDIT"}
                                onValueChange={(val) =>
                                  setAdjustmentReason((prev) => ({
                                    ...prev,
                                    [item.variantId]: val as StockReason,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-7 w-32 text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NEW_SHIPMENT">
                                    {locale === "ar" ? "شحنة جديدة / وارد" : "New Shipment"}
                                  </SelectItem>
                                  <SelectItem value="STOCK_AUDIT">
                                    {locale === "ar" ? "جرد مخزني فعلي" : "Stock Audit"}
                                  </SelectItem>
                                  <SelectItem value="DAMAGED">
                                    {locale === "ar" ? "تالف / فاقد" : "Damaged / Loss"}
                                  </SelectItem>
                                  <SelectItem value="CUSTOMER_RETURN">
                                    {locale === "ar" ? "مرتجع من عميل" : "Customer Return"}
                                  </SelectItem>
                                  <SelectItem value="OTHER">
                                    {locale === "ar" ? "أخرى" : "Other"}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                size="sm"
                                variant={hasChange ? "default" : "secondary"}
                                disabled={!hasChange || isSavingItem}
                                onClick={() => handleApplyStock(item.variantId, item.stock)}
                                className="h-7 gap-1 px-2.5 text-xs"
                              >
                                {isSavingItem ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Check className="size-3" />
                                )}
                                {locale === "ar" ? "حفظ" : "Save"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= Tab 2: 2D Matrix View ================= */}
        <TabsContent value="matrix" className="mt-4 space-y-4">
          {/* Product Picker */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                {locale === "ar" ? "اختر المنتج للمصفوفة:" : "Select Product:"}
              </Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-72 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {locale === "ar" ? p.nameAr : p.nameEn} ({p.variantCount}{" "}
                      {locale === "ar" ? "متغير" : "variants"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <Badge variant="outline" className="text-xs">
                {locale === "ar"
                  ? `إجمالي المخزون: ${selectedProduct.totalStock} قطعة`
                  : `Total Stock: ${selectedProduct.totalStock} units`}
              </Badge>
            )}
          </div>

          {/* Matrix Card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {locale === "ar" ? "مصفوفة مخزون المتغيرات" : "Variant Stock Matrix"}
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === "ar"
                  ? "توليد ديناميكي لشبكة المتغيرات (مثال: اللون × المقاس). يمكنك تعديل المخزون مباشرة من داخل كل خلية."
                  : "Dynamic 2D attributes grid. Click directly inside cells to adjust stock."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!parsedMatrix ||
              !parsedMatrix.isMatrixCompatible ||
              !parsedMatrix.cols ||
              !parsedMatrix.rows ||
              !parsedMatrix.grid ? (
                <div className="space-y-4 py-6 text-center text-muted-foreground">
                  <p className="text-sm">
                    {locale === "ar"
                      ? "هذا المنتج يحتوي على متغيرات أحادية البعد. فيما يلي جدول كميات المتغيرات:"
                      : "This product does not have multi-dimensional attributes. Here is its variant stock table:"}
                  </p>
                  <div className="mx-auto max-w-xl overflow-hidden rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-start">
                            {locale === "ar" ? "المتغير" : "Variant"}
                          </th>
                          <th className="px-3 py-2 text-start">SKU</th>
                          <th className="px-3 py-2 text-center">
                            {locale === "ar" ? "الكمية" : "Stock"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedProduct?.variants.map((v) => (
                          <tr key={v.id}>
                            <td className="px-3 py-2 font-medium">
                              {locale === "ar" ? v.nameAr : v.nameEn}
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{v.sku}</td>
                            <td className="px-3 py-2 text-center font-bold">{v.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 font-bold">
                        <th className="border p-3 text-start bg-muted/60">
                          {locale === "ar" ? "الخاصية / الصف" : "Attribute / Row"}
                        </th>
                        {parsedMatrix.cols.map((col) => (
                          <th key={col} className="border p-3 text-center">
                            {col}
                          </th>
                        ))}
                        <th className="border p-3 text-center bg-muted/60">
                          {locale === "ar" ? "الإجمالي" : "Total"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedMatrix.rows.map((row) => {
                        let rowTotal = 0;
                        return (
                          <tr key={row} className="hover:bg-muted/5">
                            <td className="border p-3 font-bold bg-muted/20">{row}</td>
                            {parsedMatrix.cols.map((col) => {
                              const variant = parsedMatrix.grid.get(`${row}:::${col}`);
                              if (!variant) {
                                return (
                                  <td
                                    key={col}
                                    className="border p-3 text-center text-muted-foreground/40"
                                  >
                                    -
                                  </td>
                                );
                              }
                              rowTotal += variant.stock;
                              const targetStock = adjustingStock[variant.id] ?? variant.stock;
                              const hasChange = targetStock !== variant.stock;

                              return (
                                <td key={col} className="border p-2 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-5 text-muted-foreground"
                                        onClick={() => handleDelta(variant.id, variant.stock, -1)}
                                      >
                                        <Minus className="size-2.5" />
                                      </Button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={targetStock}
                                        onChange={(e) =>
                                          setAdjustingStock((prev) => ({
                                            ...prev,
                                            [variant.id]: Math.max(0, Number(e.target.value)),
                                          }))
                                        }
                                        className={`size-7 rounded border text-center font-mono font-bold text-xs ${
                                          hasChange
                                            ? "border-primary bg-primary/10 text-primary"
                                            : variant.stock === 0
                                              ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                                              : "border-border"
                                        }`}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-5 text-muted-foreground"
                                        onClick={() => handleDelta(variant.id, variant.stock, 1)}
                                      >
                                        <Plus className="size-2.5" />
                                      </Button>
                                    </div>
                                    {hasChange && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px]"
                                        onClick={() => handleApplyStock(variant.id, variant.stock)}
                                      >
                                        {locale === "ar" ? "حفظ" : "Save"}
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="border p-3 text-center font-bold bg-muted/20">
                              {rowTotal}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Column Totals Row */}
                      <tr className="border-t-2 border-border font-bold bg-muted/40">
                        <td className="border p-3">{locale === "ar" ? "الإجمالي" : "Total"}</td>
                        {parsedMatrix.cols.map((col) => {
                          let colTotal = 0;
                          for (const row of parsedMatrix.rows) {
                            const v = parsedMatrix.grid.get(`${row}:::${col}`);
                            if (v) colTotal += v.stock;
                          }
                          return (
                            <td key={col} className="border p-3 text-center">
                              {colTotal}
                            </td>
                          );
                        })}
                        <td className="border p-3 text-center text-primary font-black text-sm">
                          {selectedProduct?.totalStock}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
