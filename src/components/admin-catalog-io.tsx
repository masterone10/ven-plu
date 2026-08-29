import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { exportCatalogCsv, importCatalogCsv } from "@/lib/admin-catalog-io.functions";

const SAMPLE_CSV = `product_slug,category_slug,name_en,name_ar,description_en,description_ar,cash_price,points_enabled,default_points_price,delivery_points_reward,product_is_active,variant_sku,variant_name_en,variant_name_ar,variant_cash_price,variant_points_price,variant_stock,variant_is_active,image_urls
rose-water-toner,skincare,Rose Water Toner,تونر ماء الورد,Natural refreshing facial toner.,تونر طبيعي منعش للوجه.,220.00,TRUE,440,20,TRUE,RWT-150,150 ml,150 مل,,440,30,TRUE,https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80
rose-water-toner,skincare,Rose Water Toner,تونر ماء الورد,Natural refreshing facial toner.,تونر طبيعي منعش للوجه.,220.00,TRUE,440,20,TRUE,RWT-250,250 ml,250 مل,320.00,640,20,TRUE,https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80
lavender-bath-salt,bath,Lavender Bath Salt,أملاح الاستحمام باللافندر,Relaxing mineral bath salt.,أملاح معدنية مهدئة للاستحمام.,160.00,FALSE,,15,TRUE,LBS-500G,500g,500 جم,,,45,TRUE,https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80`;

export function AdminCatalogIO() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const exportCsvFn = useServerFn(exportCatalogCsv);
  const importCsvFn = useServerFn(importCatalogCsv);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importResult, setImportResult] = useState<{
    importedProducts: number;
    importedVariants: number;
  } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await exportCsvFn();
      const blob = new Blob([res.csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        locale === "ar" ? "تم تصدير ملف الكتالوج بنجاح" : "Catalog CSV exported successfully",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export catalog");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSample = () => {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ven_plus_catalog_sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(locale === "ar" ? "تم تحميل النموذج الإرشادي" : "Downloaded sample CSV template");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
        toast.success(locale === "ar" ? `تم تحميل الملف ${file.name}` : `Loaded file ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: (text: string) => importCsvFn({ data: { csvText: text } }),
    onSuccess: (res) => {
      setImportResult(res);
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(
        locale === "ar"
          ? `تم استيراد ${res.importedProducts} منتج و ${res.importedVariants} متغير بنجاح`
          : `Imported ${res.importedProducts} products and ${res.importedVariants} variants successfully`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to import CSV");
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Export Button */}
      <Button
        variant="outline"
        size="sm"
        disabled={isExporting}
        onClick={handleExport}
        className="gap-1.5"
      >
        {isExporting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
        {locale === "ar" ? "تصدير CSV / Excel" : "Export CSV"}
      </Button>

      {/* Import Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setCsvContent("");
          setImportResult(null);
          setIsImportModalOpen(true);
        }}
        className="gap-1.5"
      >
        <Upload className="size-4" />
        {locale === "ar" ? "استيراد كتالوج CSV" : "Import CSV"}
      </Button>

      {/* Import Modal */}
      {isImportModalOpen && (
        <Dialog open onOpenChange={setIsImportModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                {locale === "ar"
                  ? "استيراد كتالوج المنتجات (CSV / Excel)"
                  : "Import Products Catalog"}
              </DialogTitle>
              <DialogDescription>
                {locale === "ar"
                  ? "قم بتحميل ملف CSV يحتوي على المنتجات والمتغيرات والأسعار والمخزون للاستيراد الجماعي."
                  : "Upload or paste a CSV file with products, variants, pricing, and stock for bulk import."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "هل تحتاج إلى قالب نموذجي للتعبئة؟"
                    : "Need a sample template to start with?"}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="gap-1 text-xs"
                >
                  <Download className="size-3.5" />
                  {locale === "ar" ? "تحميل نموذج فارغ" : "Download Sample"}
                </Button>
              </div>

              {/* Drag / Select File */}
              <div
                className="border-2 border-dashed border-border hover:border-muted-foreground/50 rounded-lg p-6 text-center cursor-pointer bg-muted/10 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="size-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-xs font-semibold text-foreground">
                  {locale === "ar"
                    ? "انقر لاختيار ملف CSV من جهازك"
                    : "Click to choose a CSV file from your computer"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Paste Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {locale === "ar"
                    ? "أو الصق محتوى ملف الـ CSV هنا مباشرة:"
                    : "Or paste CSV text directly:"}
                </label>
                <Textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={6}
                  placeholder="product_slug,category_slug,name_en,name_ar,cash_price,..."
                  className="font-mono text-xs"
                />
              </div>

              {/* Success summary */}
              {importResult && (
                <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <div>
                    {locale === "ar"
                      ? `تم بنجاح استيراد ${importResult.importedProducts} منتج و ${importResult.importedVariants} متغير في قاعدة البيانات.`
                      : `Successfully imported ${importResult.importedProducts} products and ${importResult.importedVariants} variants.`}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 flex justify-between sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsImportModalOpen(false)}>
                {locale === "ar" ? "إغلاق" : "Close"}
              </Button>
              <Button
                type="button"
                disabled={!csvContent.trim() || importMutation.isPending}
                onClick={() => importMutation.mutate(csvContent)}
                className="gap-1.5"
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {locale === "ar" ? "بدء الاستيراد الجماعي" : "Run Bulk Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
