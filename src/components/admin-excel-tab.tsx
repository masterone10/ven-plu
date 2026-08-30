import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  exportProductsCSV,
  exportOrdersExcel,
  previewOrdersExcelImport,
  executeOrdersExcelImport,
} from "@/lib/admin-operations.functions";
import type { OrderExcelPreviewResult } from "@/lib/order-excel";

export function AdminExcelTab() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const exportProductsFn = useServerFn(exportProductsCSV);
  const exportOrdersExcelFn = useServerFn(exportOrdersExcel);
  const previewImportFn = useServerFn(previewOrdersExcelImport);
  const executeImportFn = useServerFn(executeOrdersExcelImport);

  const [exportingProducts, setExportingProducts] = useState(false);
  const [exportingOrders, setExportingOrders] = useState(false);

  // Import State
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [previewResult, setPreviewResult] = useState<OrderExcelPreviewResult | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportProducts = async () => {
    setExportingProducts(true);
    try {
      const res = await exportProductsFn();
      const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
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
          ? "تم تصدير كتالوج المنتجات بنجاح بصيغة متوافقة مع Excel"
          : "Products exported successfully",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export products");
    } finally {
      setExportingProducts(false);
    }
  };

  const handleExportOrders = async () => {
    setExportingOrders(true);
    try {
      const res = await exportOrdersExcelFn();
      // Decode base64 to binary
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

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
          ? "تم تصدير سجل الطلبات بتنسيق Excel الرسمي مع تفاصيل المتغيرات والأعداد الحقيقية"
          : "Orders exported successfully with exact columns and variant breakdown",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export orders");
    } finally {
      setExportingOrders(false);
    }
  };

  const processFile = async (file: File) => {
    setAnalyzingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          const base64 = btoa(binary);

          const preview = await previewImportFn({ data: { base64 } });
          setPreviewResult(preview);
          setShowPreviewDialog(true);
        } catch (err: unknown) {
          toast.error(
            err instanceof Error
              ? err.message
              : locale === "ar"
                ? "فشل في قراءة ومعالجة ملف Excel"
                : "Failed to parse Excel file",
          );
        } finally {
          setAnalyzingFile(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: unknown) {
      setAnalyzingFile(false);
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewResult || previewResult.changes.length === 0) return;

    setExecutingImport(true);
    try {
      const payload = {
        changes: previewResult.changes.map((c) => ({
          orderId: c.orderId,
          orderNumber: c.orderNumber,
          customerName: c.customerName,
          customerPhone: c.customerPhone,
          secondPhone: c.secondPhone,
          address: c.address,
          status: c.status,
          itemChanges: c.itemChanges,
        })),
      };

      const res = await executeImportFn({ data: payload });

      toast.success(
        locale === "ar"
          ? `تم تحديث ${res.updatedOrdersCount} طلب بنجاح وإعادة احتساب الكميات والإجماليات بدقة.`
          : `Successfully updated ${res.updatedOrdersCount} orders.`,
      );

      setShowPreviewDialog(false);
      setPreviewResult(null);

      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-metrics"] });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : locale === "ar"
            ? "فشل استيراد وتحديث الطلبات"
            : "Failed to execute order import",
      );
    } finally {
      setExecutingImport(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {locale === "ar"
            ? "تصدير واستيراد الطلبات (Excel / CSV)"
            : "Orders Excel Export & Re-Import"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {locale === "ar"
            ? "نظام تصدير وإعادة استيراد الطلبات المعتمد: الحفاظ التام على أعمدة الملف (Order Number, 2 Phone Numbers, Address, Items Breakdown, العدد) مع التحديث الذري للأوردرات الحالية وإعادة الاحتساب المالي التلقائي."
            : "Export and re-import orders preserving exact 14 columns, phone leading zeros, real variant mapping, and atomic server updates."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Official Orders Excel */}
        <Card className="rounded-2xl border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
              <FileSpreadsheet className="size-5" />
            </div>
            <CardTitle className="text-base font-bold">
              {locale === "ar"
                ? "تصدير سجل الطلبات الرسمي (Excel .xlsx)"
                : "Export Orders (Official Excel .xlsx)"}
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === "ar"
                ? "يحتوي على الأعمدة الـ 14 المعتمدة (رقم الطلب، التاريخ، الحالة، طريقة التمويل، اسم العميل، الهاتف، الهاتف الثاني، العنوان، الإجماليات، تفاصيل المنتجات، والعدد الحقيقي)."
                : "Exact 14-column format with Customer Phone, second phone, Items Breakdown (Color & Size), and exact total pieces."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Items Breakdown:</span>
                <span className="text-foreground font-medium">Product (Color - Size) xQty</span>
              </div>
              <div className="flex justify-between">
                <span>العدد:</span>
                <span className="text-foreground font-medium">Server Calculated Pieces</span>
              </div>
            </div>
            <Button
              onClick={handleExportOrders}
              disabled={exportingOrders}
              className="w-full gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {exportingOrders ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {locale === "ar"
                ? "تصدير ملف الأوردرات (Excel .xlsx)"
                : "Export Orders Excel (.xlsx)"}
            </Button>
          </CardContent>
        </Card>

        {/* Re-Import Orders Card */}
        <Card className="rounded-2xl border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <Upload className="size-5" />
            </div>
            <CardTitle className="text-base font-bold">
              {locale === "ar"
                ? "إعادة استيراد وتحديث الطلبات (Re-Import)"
                : "Re-Import Orders from Excel"}
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === "ar"
                ? "قم بتعديل ملف Excel المُصدَّر ورفعه هنا لتحديث بيانات العميل، أرقام الهواتف، العناوين، وحالات وكميات المنتجات لنفس الأوردرات مع معاينة فورية قبل الحفظ."
                : "Upload modified Excel file to update existing orders by Order Number with preview."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-muted/20"
              }`}
            >
              {analyzingFile ? (
                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    {locale === "ar"
                      ? "جاري قراءة وتحليل ملف Excel ومطابقة الأوردرات..."
                      : "Analyzing Excel and matching orders..."}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-2 space-y-1">
                  <Upload className="size-6 text-muted-foreground mb-1" />
                  <span className="text-xs font-semibold text-foreground">
                    {locale === "ar"
                      ? "اضغط لاختيار ملف Excel أو اسحبه هنا"
                      : "Click to select Excel file or drag & drop"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    .xlsx, .xls, .csv (ven_orders_export_*.xlsx)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Catalog Export Card */}
      <Card className="rounded-2xl border-border/80 bg-card">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-2">
            <FileText className="size-5" />
          </div>
          <CardTitle className="text-base font-bold">
            {locale === "ar" ? "تصدير كتالوج المنتجات والمتغيرات" : "Export Products Catalog"}
          </CardTitle>
          <CardDescription className="text-xs">
            {locale === "ar"
              ? "تصدير قائمة المنتجات وكود الـ SKU وأسعار الكاش والنقاط والمخزون الحالي لكل متغير."
              : "Export product catalog and variant inventory SKUs, cash & points prices."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleExportProducts}
            disabled={exportingProducts}
            className="w-full gap-2 rounded-xl"
          >
            {exportingProducts ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {locale === "ar" ? "تصدير كتالوج المنتجات (CSV / Excel)" : "Export Products Catalog"}
          </Button>
        </CardContent>
      </Card>

      {/* RE-IMPORT PREVIEW DIALOG */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              {locale === "ar"
                ? "معاينة استيراد وتحديث الأوردرات (Import Preview)"
                : "Orders Re-Import Preview"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ar"
                ? "راجع التعديلات التي تم اكتشافها في الملف قبل تطبيقها على قاعدة البيانات بشكل نهائي."
                : "Review the detected changes before committing updates to the database."}
            </DialogDescription>
          </DialogHeader>

          {previewResult && (
            <div className="space-y-4 py-2">
              {/* Metric Badges Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "الطلبات المعدلة" : "Orders"}
                  </div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {previewResult.ordersCount}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "تحديثات الهواتف" : "Phone Updates"}
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {previewResult.phoneUpdatesCount + previewResult.secondaryPhoneUpdatesCount}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "تحديثات العناوين" : "Address Updates"}
                  </div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {previewResult.addressUpdatesCount}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "تعديل الكميات والمتغيرات" : "Qty / Variants"}
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {previewResult.variantChangesCount}
                  </div>
                </div>
              </div>

              {/* Validation Errors & Warnings */}
              {previewResult.errors.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-1.5 text-xs text-destructive">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="size-4" />
                    {locale === "ar" ? "أخطاء تمنع الاستيراد:" : "Validation Errors:"}
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px]">
                    {previewResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Changes Breakdown List */}
              {previewResult.changes.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-foreground">
                    {locale === "ar" ? "تفاصيل التعديلات لكل طلب:" : "Order Modification Details:"}
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {previewResult.changes.map((ch, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-card p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between font-bold text-foreground">
                          <span className="font-mono text-primary">{ch.orderNumber}</span>
                          {ch.status && (
                            <Badge variant="outline" className="text-[10px]">
                              {ch.status.old} → {ch.status.new}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {ch.customerName && (
                            <div>
                              <span className="text-muted-foreground">
                                {locale === "ar" ? "الاسم: " : "Name: "}
                              </span>
                              <span className="line-through text-muted-foreground mr-1">
                                {ch.customerName.old}
                              </span>
                              <span className="font-medium text-foreground">
                                {ch.customerName.new}
                              </span>
                            </div>
                          )}

                          {ch.customerPhone && (
                            <div>
                              <span className="text-muted-foreground">
                                {locale === "ar" ? "الهاتف: " : "Phone: "}
                              </span>
                              <span className="line-through text-muted-foreground mr-1 font-mono">
                                {ch.customerPhone.old}
                              </span>
                              <span className="font-medium text-blue-600 font-mono">
                                {ch.customerPhone.new}
                              </span>
                            </div>
                          )}

                          {ch.secondPhone && (
                            <div>
                              <span className="text-muted-foreground">
                                {locale === "ar" ? "هاتف إضافي: " : "Second Phone: "}
                              </span>
                              <span className="line-through text-muted-foreground mr-1 font-mono">
                                {ch.secondPhone.old || "—"}
                              </span>
                              <span className="font-medium text-blue-600 font-mono">
                                {ch.secondPhone.new}
                              </span>
                            </div>
                          )}

                          {ch.address && (
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                {locale === "ar" ? "العنوان: " : "Address: "}
                              </span>
                              <span className="line-through text-muted-foreground mr-1">
                                {ch.address.old}
                              </span>
                              <span className="font-medium text-foreground">{ch.address.new}</span>
                            </div>
                          )}

                          {ch.totalQuantity && (
                            <div>
                              <span className="text-muted-foreground">
                                {locale === "ar" ? "إجمالي القطع (العدد): " : "Total Pieces: "}
                              </span>
                              <span className="line-through text-muted-foreground mr-1">
                                {ch.totalQuantity.old}
                              </span>
                              <span className="font-bold text-emerald-600">
                                {ch.totalQuantity.new}
                              </span>
                            </div>
                          )}

                          {ch.cashTotal && (
                            <div>
                              <span className="text-muted-foreground">
                                {locale === "ar"
                                  ? "إجمالي الكاش المعاد حسابه: "
                                  : "Recalculated Cash: "}
                              </span>
                              <span className="font-bold text-foreground">
                                {ch.cashTotal.new} EGP
                              </span>
                            </div>
                          )}
                        </div>

                        {ch.itemChanges && ch.itemChanges.length > 0 && (
                          <div className="pt-1 border-t border-border/60">
                            <div className="text-[10px] text-muted-foreground mb-1">
                              {locale === "ar" ? "الكميات المعدلة:" : "Modified Quantities:"}
                            </div>
                            <div className="space-y-1">
                              {ch.itemChanges.map((it, itIdx) => (
                                <div
                                  key={itIdx}
                                  className="flex items-center justify-between text-[11px] bg-muted/40 rounded px-2 py-0.5"
                                >
                                  <span>{it.name}</span>
                                  <span className="font-mono">
                                    <span className="line-through text-muted-foreground mr-1">
                                      x{it.oldQty}
                                    </span>
                                    <span className="font-bold text-emerald-600">x{it.newQty}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "لم يتم العثور على أية تغييرات في الملف مقارنة بالبيانات الحالية."
                    : "No changes detected between the Excel file and current database records."}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              disabled={executingImport}
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={
                executingImport ||
                !previewResult ||
                previewResult.changes.length === 0 ||
                previewResult.errors.length > 0
              }
              className="gap-2 bg-primary font-medium"
            >
              {executingImport ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {locale === "ar" ? "تأكيد الاستيراد والتحديث الذري" : "Confirm & Update Orders"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
