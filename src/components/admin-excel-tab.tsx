import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { exportProductsCSV, exportOrdersCSV } from "@/lib/admin-operations.functions";

export function AdminExcelTab() {
  const { locale } = useI18n();
  const exportProductsFn = useServerFn(exportProductsCSV);
  const exportOrdersFn = useServerFn(exportOrdersCSV);

  const [exportingProducts, setExportingProducts] = useState(false);
  const [exportingOrders, setExportingOrders] = useState(false);

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
      const res = await exportOrdersFn();
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
          ? "تم تصدير سجل الطلبات بنجاح بصيغة متوافقة مع Excel"
          : "Orders exported successfully",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export orders");
    } finally {
      setExportingOrders(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {locale === "ar"
            ? "تصدير واستيراد البيانات (Excel / CSV)"
            : "Data Import & Export (Excel / CSV)"}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locale === "ar"
            ? "تصدير ملفات البيانات مشفرة بتقنية UTF-8 BOM لضمان فتح النصوص العربية في Microsoft Excel بدون رموز مشوهة."
            : "Export CSV files with UTF-8 BOM encoding ensuring perfect Arabic character rendering in Excel."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Products Export Card */}
        <Card className="rounded-2xl border-border/80 bg-card">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <FileSpreadsheet className="size-5" />
            </div>
            <CardTitle className="text-base font-bold">
              {locale === "ar" ? "تصدير كتالوج المنتجات والمتغيرات" : "Export Products Catalog"}
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === "ar"
                ? "يشمل كود SKU، الأسعار الكاش، أسعار النقاط، نقاط المكافأة، وحالة المخزون لكل منتج."
                : "Includes SKUs, cash & points prices, delivery points rewards, and variant stocks."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExportProducts}
              disabled={exportingProducts}
              className="w-full gap-2 rounded-xl"
            >
              {exportingProducts ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {locale === "ar" ? "تصدير المنتجات (CSV / Excel)" : "Export Products CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* Orders Export Card */}
        <Card className="rounded-2xl border-border/80 bg-card">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent mb-2">
              <FileSpreadsheet className="size-5" />
            </div>
            <CardTitle className="text-base font-bold">
              {locale === "ar" ? "تصدير سجل طلبات العملاء" : "Export Customer Orders"}
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === "ar"
                ? "يشمل أرقام الطلبات، بيانات العملاء، العناوين، تفاصيل المنتجات، وطرق الدفع والتمويل."
                : "Includes order numbers, customer data, shipping addresses, and items breakdown."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleExportOrders}
              disabled={exportingOrders}
              className="w-full gap-2 rounded-xl border-accent/40 text-accent hover:bg-accent/10"
            >
              {exportingOrders ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {locale === "ar" ? "تصدير الطلبات (CSV / Excel)" : "Export Orders CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
