import { useState, useMemo } from "react";
import {
  Boxes,
  Check,
  ChevronDown,
  Layers,
  Minus,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import type { VariantInput } from "@/lib/admin-product-rules";
import {
  applyBulkStockToAll,
  applyBulkStockToColor,
  applyBulkStockToSize,
  buildMatrix,
  calculateColumnTotal,
  calculateGrandTotal,
  calculateRowTotal,
  extractMatrixFromVariants,
  type MatrixCell,
} from "@/lib/variant-matrix";

interface AdminVariantMatrixProps {
  variants: VariantInput[];
  baseSku: string;
  baseCashPrice: number;
  pointsEnabled: boolean;
  defaultPointsPrice: number | null;
  onChange: (updatedVariants: VariantInput[]) => void;
}

export function AdminVariantMatrix({
  variants,
  baseSku,
  baseCashPrice,
  pointsEnabled,
  defaultPointsPrice,
  onChange,
}: AdminVariantMatrixProps) {
  const { locale, formatEGP, formatPoints } = useI18n();

  // Extract or initialize colors & sizes
  const initialData = useMemo(() => {
    const extracted = extractMatrixFromVariants(variants, baseSku);
    if (extracted.colors.length > 0 && extracted.sizes.length > 0) {
      return extracted;
    }
    // Default starting state if new product
    return {
      colors: ["أسود", "أبيض"],
      sizes: ["M", "L", "XL"],
      cells: buildMatrix(["أسود", "أبيض"], ["M", "L", "XL"], variants, baseSku),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [colors, setColors] = useState<string[]>(initialData.colors);
  const [sizes, setSizes] = useState<string[]>(initialData.sizes);
  const [cells, setCells] = useState<MatrixCell[]>(initialData.cells);

  const [newColorInput, setNewColorInput] = useState("");
  const [newSizeInput, setNewSizeInput] = useState("");
  const [activeDetailCell, setActiveDetailCell] = useState<MatrixCell | null>(null);

  // Bulk stock state
  const [bulkColor, setBulkColor] = useState<string>(colors[0] || "");
  const [bulkColorQty, setBulkColorQty] = useState<number>(20);
  const [bulkSize, setBulkSize] = useState<string>(sizes[0] || "");
  const [bulkSizeQty, setBulkSizeQty] = useState<number>(10);
  const [bulkAllQty, setBulkAllQty] = useState<number>(15);

  // Sync matrix to parent variants
  const pushMatrixToParent = (updatedCells: MatrixCell[]) => {
    setCells(updatedCells);
    const converted: VariantInput[] = updatedCells.map((c) => ({
      id: c.id,
      sku: c.sku,
      nameAr: c.variantNameAr,
      nameEn: c.variantNameEn,
      stock: c.stock,
      cashPrice: null,
      pointsPrice: null,
      isActive: c.isActive,
    }));
    onChange(converted);
  };

  // Add a new color
  const handleAddColor = () => {
    const trimmed = newColorInput.trim();
    if (!trimmed || colors.includes(trimmed)) return;
    const nextColors = [...colors, trimmed];
    setColors(nextColors);
    setNewColorInput("");
    if (!bulkColor) setBulkColor(trimmed);
    const nextCells = buildMatrix(nextColors, sizes, cells, baseSku);
    pushMatrixToParent(nextCells);
  };

  // Remove a color
  const handleRemoveColor = (colorToRemove: string) => {
    if (colors.length <= 1) return;
    const nextColors = colors.filter((c) => c !== colorToRemove);
    setColors(nextColors);
    if (bulkColor === colorToRemove) setBulkColor(nextColors[0] || "");
    const nextCells = buildMatrix(nextColors, sizes, cells, baseSku);
    pushMatrixToParent(nextCells);
  };

  // Add a new size
  const handleAddSize = () => {
    const trimmed = newSizeInput.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    const nextSizes = [...sizes, trimmed];
    setSizes(nextSizes);
    setNewSizeInput("");
    if (!bulkSize) setBulkSize(trimmed);
    const nextCells = buildMatrix(colors, nextSizes, cells, baseSku);
    pushMatrixToParent(nextCells);
  };

  // Remove a size
  const handleRemoveSize = (sizeToRemove: string) => {
    if (sizes.length <= 1) return;
    const nextSizes = sizes.filter((s) => s !== sizeToRemove);
    setSizes(nextSizes);
    if (bulkSize === sizeToRemove) setBulkSize(nextSizes[0] || "");
    const nextCells = buildMatrix(colors, nextSizes, cells, baseSku);
    pushMatrixToParent(nextCells);
  };

  // Direct cell stock change
  const handleCellStockChange = (color: string, size: string, newStock: number) => {
    const stockVal = Math.max(0, Math.floor(newStock));
    const nextCells = cells.map((c) => {
      if (c.color === color && c.size === size) {
        return { ...c, stock: stockVal };
      }
      return c;
    });
    pushMatrixToParent(nextCells);
  };

  // Save detail updates for a cell
  const handleSaveCellDetail = (updated: MatrixCell) => {
    const nextCells = cells.map((c) => (c.sku === updated.sku ? updated : c));
    pushMatrixToParent(nextCells);
    setActiveDetailCell(null);
  };

  // Bulk Apply handlers
  const handleApplyBulkColor = () => {
    if (!bulkColor) return;
    const nextCells = applyBulkStockToColor(cells, bulkColor, bulkColorQty);
    pushMatrixToParent(nextCells);
  };

  const handleApplyBulkSize = () => {
    if (!bulkSize) return;
    const nextCells = applyBulkStockToSize(cells, bulkSize, bulkSizeQty);
    pushMatrixToParent(nextCells);
  };

  const handleApplyBulkAll = () => {
    const nextCells = applyBulkStockToAll(cells, bulkAllQty);
    pushMatrixToParent(nextCells);
  };

  const grandTotal = calculateGrandTotal(cells);

  return (
    <div className="space-y-6">
      {/* SECTION 1: Color & Size Tags Manager */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Colors Manager */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>🎨</span>
              <span>{locale === "ar" ? "الألوان المتاحة" : "Available Colors"}</span>
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {colors.length} {locale === "ar" ? "ألوان" : "colors"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[36px] items-center">
            {colors.map((color) => (
              <Badge
                key={color}
                variant="secondary"
                className="gap-1.5 py-1 px-2.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border"
              >
                <span>{color}</span>
                {colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveColor(color)}
                    className="size-3.5 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newColorInput}
              onChange={(e) => setNewColorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddColor();
                }
              }}
              placeholder={locale === "ar" ? "اسم اللون (مثال: أزرق)" : "Color name (e.g. Blue)"}
              className="h-8 text-xs bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddColor}
              disabled={!newColorInput.trim()}
              className="h-8 text-xs font-bold shrink-0 gap-1"
            >
              <Plus className="size-3" />
              {locale === "ar" ? "إضافة لون" : "Add Color"}
            </Button>
          </div>
        </div>

        {/* Sizes Manager */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>📏</span>
              <span>{locale === "ar" ? "المقاسات المتاحة" : "Available Sizes"}</span>
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {sizes.length} {locale === "ar" ? "مقاسات" : "sizes"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[36px] items-center">
            {sizes.map((size) => (
              <Badge
                key={size}
                variant="secondary"
                className="gap-1.5 py-1 px-2.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border"
              >
                <span>{size}</span>
                {sizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSize(size)}
                    className="size-3.5 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newSizeInput}
              onChange={(e) => setNewSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSize();
                }
              }}
              placeholder={locale === "ar" ? "المقاس (مثال: XXL)" : "Size (e.g. XXL)"}
              className="h-8 text-xs bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSize}
              disabled={!newSizeInput.trim()}
              className="h-8 text-xs font-bold shrink-0 gap-1"
            >
              <Plus className="size-3" />
              {locale === "ar" ? "إضافة مقاس" : "Add Size"}
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Bulk Stock Operations Toolbar */}
      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
          {locale === "ar" ? "⚡ أدوات المخزون السريع (Bulk Stock)" : "⚡ Quick Bulk Stock Tools"}
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Apply to Color */}
          <div className="flex items-center gap-1.5 bg-card p-2 rounded-lg border border-border">
            <select
              value={bulkColor}
              onChange={(e) => setBulkColor(e.target.value)}
              className="h-7 text-xs bg-background border border-input rounded px-1.5 font-medium flex-1"
            >
              {colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              value={bulkColorQty}
              onChange={(e) => setBulkColorQty(parseInt(e.target.value) || 0)}
              className="h-7 w-16 text-xs text-center font-bold"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyBulkColor}
              className="h-7 px-2.5 text-xs font-semibold"
            >
              {locale === "ar" ? "تطبيق" : "Apply"}
            </Button>
          </div>

          {/* Apply to Size */}
          <div className="flex items-center gap-1.5 bg-card p-2 rounded-lg border border-border">
            <select
              value={bulkSize}
              onChange={(e) => setBulkSize(e.target.value)}
              className="h-7 text-xs bg-background border border-input rounded px-1.5 font-medium flex-1"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              value={bulkSizeQty}
              onChange={(e) => setBulkSizeQty(parseInt(e.target.value) || 0)}
              className="h-7 w-16 text-xs text-center font-bold"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyBulkSize}
              className="h-7 px-2.5 text-xs font-semibold"
            >
              {locale === "ar" ? "تطبيق" : "Apply"}
            </Button>
          </div>

          {/* Apply to All */}
          <div className="flex items-center gap-1.5 bg-card p-2 rounded-lg border border-border">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap px-1">
              {locale === "ar" ? "الكل:" : "All:"}
            </span>
            <Input
              type="number"
              min="0"
              value={bulkAllQty}
              onChange={(e) => setBulkAllQty(parseInt(e.target.value) || 0)}
              className="h-7 flex-1 text-xs text-center font-bold"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyBulkAll}
              className="h-7 px-2.5 text-xs font-semibold"
            >
              {locale === "ar" ? "تطبيق على الكل" : "Apply to All"}
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Color × Size Quantity Matrix Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-accent" />
            <span className="font-bold text-sm text-foreground">
              {locale === "ar" ? "مصفوفة المتغيرات والمخزون" : "Color × Size Quantity Matrix"}
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {colors.length} {locale === "ar" ? "ألوان" : "colors"} × {sizes.length}{" "}
            {locale === "ar" ? "مقاسات" : "sizes"} = {cells.length}{" "}
            {locale === "ar" ? "متغير" : "variants"}
          </Badge>
        </div>

        {/* Matrix Grid with Horizontal Scroll */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="p-3 font-bold text-foreground text-start sticky start-0 bg-muted/90 backdrop-blur z-10 min-w-[120px]">
                  {locale === "ar" ? "اللون / المقاس" : "Color / Size"}
                </th>
                {sizes.map((size) => (
                  <th
                    key={size}
                    className="p-3 font-bold text-center text-foreground min-w-[110px]"
                  >
                    {size}
                  </th>
                ))}
                <th className="p-3 font-bold text-center text-foreground bg-muted/70 min-w-[90px]">
                  {locale === "ar" ? "إجمالي اللون" : "Row Total"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {colors.map((color) => {
                const rowTotal = calculateRowTotal(cells, color);
                return (
                  <tr key={color} className="hover:bg-muted/10 transition">
                    {/* Color Name Header Cell (Sticky on Horizontal Scroll) */}
                    <td className="p-3 font-bold text-foreground text-start sticky start-0 bg-card/95 backdrop-blur z-10 border-e border-border/40">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-primary/60 shrink-0" />
                        <span className="truncate">{color}</span>
                      </div>
                    </td>

                    {/* Size Cells for this Color */}
                    {sizes.map((size) => {
                      const cell = cells.find((c) => c.color === color && c.size === size);
                      if (!cell)
                        return (
                          <td key={size} className="p-2 text-center text-muted-foreground">
                            —
                          </td>
                        );

                      return (
                        <td key={size} className="p-2 text-center">
                          <div className="flex flex-col items-center gap-1 bg-background/60 p-1.5 rounded-lg border border-border/70 hover:border-primary/50 transition">
                            <div className="flex items-center gap-1 w-full justify-center">
                              <Input
                                type="number"
                                min="0"
                                value={cell.stock}
                                disabled={!cell.isActive}
                                onChange={(e) =>
                                  handleCellStockChange(color, size, parseInt(e.target.value) || 0)
                                }
                                className={`h-8 w-16 text-center font-bold text-xs ${
                                  !cell.isActive
                                    ? "opacity-40 line-through bg-muted"
                                    : cell.stock === 0
                                      ? "text-amber-500 border-amber-500/40"
                                      : "text-foreground"
                                }`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setActiveDetailCell(cell)}
                                title={
                                  locale === "ar"
                                    ? "تفاصيل متقدمة للـ Variant"
                                    : "Advanced Variant Details"
                                }
                                className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                              >
                                <Settings2 className="size-3.5" />
                              </Button>
                            </div>

                            {/* Mini SKU & Active state badge */}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-mono text-muted-foreground/80 truncate max-w-[85px]">
                                {cell.sku}
                              </span>
                              {!cell.isActive && (
                                <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5">
                                  {locale === "ar" ? "معطل" : "Off"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    {/* Row Total */}
                    <td className="p-3 text-center font-black text-sm text-foreground bg-muted/20">
                      {rowTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Column Totals Footer */}
            <tfoot>
              <tr className="bg-muted/60 border-t-2 border-border font-bold">
                <td className="p-3 text-start sticky start-0 bg-muted/95 backdrop-blur z-10">
                  {locale === "ar" ? "إجمالي المقاس" : "Column Total"}
                </td>
                {sizes.map((size) => {
                  const colTotal = calculateColumnTotal(cells, size);
                  return (
                    <td key={size} className="p-3 text-center text-sm font-bold text-foreground">
                      {colTotal}
                    </td>
                  );
                })}
                <td className="p-3 text-center text-base font-black text-primary bg-primary/10">
                  {grandTotal} {locale === "ar" ? "قطعة" : "pcs"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Advanced Variant Detail Modal */}
      {activeDetailCell && (
        <VariantDetailDialog
          cell={activeDetailCell}
          open={Boolean(activeDetailCell)}
          onClose={() => setActiveDetailCell(null)}
          onSave={handleSaveCellDetail}
        />
      )}
    </div>
  );
}

/**
 * Modal to edit advanced per-variant properties (SKU, Stock, Active State)
 * without leaving the Matrix workspace.
 */
function VariantDetailDialog({
  cell,
  open,
  onClose,
  onSave,
}: {
  cell: MatrixCell;
  open: boolean;
  onClose: () => void;
  onSave: (updated: MatrixCell) => void;
}) {
  const { locale } = useI18n();
  const [draft, setDraft] = useState<MatrixCell>({ ...cell });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⚙️</span>
            <span>
              {locale === "ar"
                ? `تفاصيل المتغير: ${cell.color} × ${cell.size}`
                : `Variant Details: ${cell.color} × ${cell.size}`}
            </span>
          </DialogTitle>
          <DialogDescription>
            {locale === "ar"
              ? "تعديل كود SKU، حالة التفعيل والمخزون لهذا المتغير."
              : "Customize SKU, active status and stock."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="var-sku">{locale === "ar" ? "كود SKU *" : "SKU *"}</Label>
            <Input
              id="var-sku"
              value={draft.sku}
              required
              onChange={(e) => setDraft((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="var-stock">{locale === "ar" ? "المخزون" : "Stock"}</Label>
            <Input
              id="var-stock"
              type="number"
              min="0"
              value={draft.stock}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  stock: Math.max(0, parseInt(e.target.value) || 0),
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
            <div className="space-y-0.5">
              <Label className="font-bold">
                {locale === "ar" ? "حالة المتغير (متاح للبيع)" : "Active / Available for sale"}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {draft.isActive
                  ? locale === "ar"
                    ? "متاح للطلب والشراء"
                    : "Available for purchase"
                  : locale === "ar"
                    ? "معطل وغير متاح للعملاء"
                    : "Disabled / Hidden from customers"}
              </p>
            </div>
            <Switch
              checked={draft.isActive}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isActive: checked }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {locale === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="button" onClick={() => onSave(draft)} className="font-bold">
            {locale === "ar" ? "حفظ التعديلات" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
