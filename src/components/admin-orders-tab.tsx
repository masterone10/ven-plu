import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Eye,
  Gift,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  User,
  X,
  XCircle,
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
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import {
  listAdminOrders,
  updateAdminOrderStatus,
  exportOrdersCSV,
} from "@/lib/admin-operations.functions";
import type { OrderStatus } from "@/lib/orders-rules";

interface AdminOrderItem {
  id: string;
  quantity: number;
  product_name_ar: string;
  variant_name_ar?: string | null;
  sku?: string | null;
  line_cash_total: number;
  line_points_total: number;
}

interface AdminOrderView {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  status: OrderStatus;
  fundingMode: string;
  cashTotal: number;
  pointsTotal: number;
  shippingAddress?: {
    address?: string;
    city?: string;
    street?: string;
    notes?: string;
  } | null;
  items?: AdminOrderItem[];
}

export function AdminOrdersTab() {
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const fetchOrders = useServerFn(listAdminOrders);
  const updateStatusFn = useServerFn(updateAdminOrderStatus);
  const exportCsvFn = useServerFn(exportOrdersCSV);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderView | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders", query, statusFilter, page],
    queryFn: () =>
      fetchOrders({
        data: {
          query,
          status: statusFilter,
          fundingMode: "ALL",
          page,
          pageSize: 15,
        },
      }),
  });

  const orders: AdminOrderView[] = (data?.orders as AdminOrderView[]) ?? [];

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setBusy(true);
    try {
      await updateStatusFn({
        data: {
          orderId,
          newStatus,
          notes: `Status updated to ${newStatus} by admin`,
        },
      });

      toast.success(
        locale === "ar"
          ? `تم تحديث حالة الطلب إلى: ${newStatus}`
          : `Order status updated to: ${newStatus}`,
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-metrics"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await exportCsvFn();
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
        locale === "ar" ? "تم تصدير ملف الطلبات بنجاح" : "Orders exported successfully",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export orders");
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_CONFIRMATION":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
            قيد التأكيد
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 border-blue-500/30">
            مؤكد
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge
            variant="secondary"
            className="bg-indigo-500/15 text-indigo-600 border-indigo-500/30"
          >
            جاري التجهيز
          </Badge>
        );
      case "SHIPPED":
        return (
          <Badge
            variant="secondary"
            className="bg-purple-500/15 text-purple-600 border-purple-500/30"
          >
            تم الشحن
          </Badge>
        );
      case "DELIVERED":
        return <Badge className="bg-emerald-600 text-white">تم التوصيل</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {locale === "ar" ? "إدارة طلبات العملاء" : "Customer Orders Management"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "متابعة طلبات العملاء، تحديث دورة حياة الطلب، ومنح نقاط المكافأة تلقائياً عند التوصيل."
              : "Track customer orders and manage delivery points rewards."}
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

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            className="gap-1.5 rounded-xl text-xs"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {locale === "ar" ? "تصدير الطلبات Excel" : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={
              locale === "ar"
                ? "ابحث برقم الطلب، اسم العميل، أو رقم الهاتف..."
                : "Search by order #, customer name, or phone..."
            }
            className="ps-10 h-11 rounded-xl text-sm border-border bg-card shadow-sm"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: "ALL", labelAr: "الكل", labelEn: "All" },
            { key: "PENDING_CONFIRMATION", labelAr: "قيد التأكيد", labelEn: "Pending" },
            { key: "CONFIRMED", labelAr: "مؤكد", labelEn: "Confirmed" },
            { key: "PROCESSING", labelAr: "جاري التجهيز", labelEn: "Processing" },
            { key: "SHIPPED", labelAr: "تم الشحن", labelEn: "Shipped" },
            { key: "DELIVERED", labelAr: "تم التوصيل", labelEn: "Delivered" },
            { key: "CANCELLED", labelAr: "ملغي", labelEn: "Cancelled" },
          ].map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={statusFilter === item.key ? "default" : "outline"}
              onClick={() => {
                setStatusFilter(item.key);
                setPage(1);
              }}
              className="rounded-full text-xs shrink-0 h-8"
            >
              {locale === "ar" ? item.labelAr : item.labelEn}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl">
          <Package className="size-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-bold">
            {locale === "ar" ? "لا توجد طلبات مطابقة" : "No matching orders found"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === "ar"
              ? "جرّب تغيير عبارة البحث أو فلتر الحالة."
              : "Try changing your search terms or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
            <table className="w-full text-xs text-start">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{locale === "ar" ? "رقم الطلب" : "Order #"}</th>
                  <th className="p-3 text-start">{locale === "ar" ? "العميل" : "Customer"}</th>
                  <th className="p-3 text-start">{locale === "ar" ? "الهاتف" : "Phone"}</th>
                  <th className="p-3 text-start">{locale === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="p-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th>
                  <th className="p-3 text-start">{locale === "ar" ? "طريقة التمويل" : "Mode"}</th>
                  <th className="p-3 text-start">
                    {locale === "ar" ? "المجموع الكاش" : "Cash Total"}
                  </th>
                  <th className="p-3 text-start">{locale === "ar" ? "النقاط" : "Points"}</th>
                  <th className="p-3 text-end">{locale === "ar" ? "التفاصيل" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-bold text-foreground">{o.orderNumber}</td>
                    <td className="p-3 font-semibold">{o.customerName}</td>
                    <td className="p-3 font-mono text-muted-foreground">{o.customerPhone}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="p-3">{getStatusBadge(o.status)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {o.fundingMode === "CASH_ONLY"
                          ? "كاش فقط"
                          : o.fundingMode === "POINTS_ONLY"
                            ? "نقاط فقط"
                            : "مختلط"}
                      </Badge>
                    </td>
                    <td className="p-3 font-bold">{formatEGP(o.cashTotal)}</td>
                    <td className="p-3 font-medium">
                      {o.pointsTotal > 0 ? (
                        <span className="text-accent font-bold">{formatPoints(o.pointsTotal)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedOrder(o)}
                        className="h-8 px-2.5 text-xs font-semibold gap-1"
                      >
                        <Eye className="size-3.5" />
                        {locale === "ar" ? "معاينة" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(data?.pageCount ?? 1) > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>
                {locale === "ar"
                  ? `صفحة ${data?.page} من ${data?.pageCount}`
                  : `Page ${data?.page} of ${data?.pageCount}`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="size-8 rounded-lg"
                >
                  <ChevronRight className="size-4 rtl:rotate-0 ltr:rotate-180" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= (data?.pageCount ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="size-8 rounded-lg"
                >
                  <ChevronLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold font-mono">
                      {selectedOrder.orderNumber}
                    </DialogTitle>
                    <DialogDescription>
                      {new Date(selectedOrder.createdAt).toLocaleString("en-GB")}
                    </DialogDescription>
                  </div>
                  <div>{getStatusBadge(selectedOrder.status)}</div>
                </div>
              </DialogHeader>

              <div className="space-y-6 pt-2">
                {/* Customer and Shipping Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/80 bg-muted/20 p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <User className="size-4 text-primary" />
                      <span>{selectedOrder.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="size-3.5" />
                      <span className="font-mono">{selectedOrder.customerPhone}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="size-3.5 shrink-0 text-primary mt-0.5" />
                      <span>
                        {selectedOrder.shippingAddress?.address || ""},{" "}
                        {selectedOrder.shippingAddress?.city || ""}{" "}
                        {selectedOrder.shippingAddress?.street
                          ? `(${selectedOrder.shippingAddress.street})`
                          : ""}
                      </span>
                    </div>
                    {selectedOrder.shippingAddress?.notes && (
                      <p className="text-[11px] bg-background p-2 rounded border border-border/60">
                        ملاحظات العميل: {selectedOrder.shippingAddress.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {locale === "ar" ? "عناصر الطلب" : "Order Items"}
                  </h4>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden">
                    {selectedOrder.items?.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-foreground">{item.product_name_ar}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {item.variant_name_ar || item.sku} &times; {item.quantity}
                          </p>
                        </div>
                        <div className="text-end font-semibold">
                          {item.line_cash_total > 0 && (
                            <span>{formatEGP(item.line_cash_total)}</span>
                          )}
                          {item.line_points_total > 0 && (
                            <span className="text-accent block text-[11px]">
                              {formatPoints(item.line_points_total)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Totals */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border/80">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {locale === "ar" ? "إجمالي الكاش المطلوب:" : "Total Cash Due:"}
                    </span>
                    <span className="text-lg font-black text-foreground">
                      {formatEGP(selectedOrder.cashTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {locale === "ar" ? "إجمالي النقاط المخصومة:" : "Total Points Paid:"}
                    </span>
                    <span className="text-lg font-black text-accent">
                      {selectedOrder.pointsTotal > 0
                        ? formatPoints(selectedOrder.pointsTotal)
                        : "0 نقطة"}
                    </span>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-bold text-foreground">
                    {locale === "ar" ? "تغيير حالة الطلب:" : "Update Lifecycle Status:"}
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === "PENDING_CONFIRMATION" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => handleStatusChange(selectedOrder.id, "CONFIRMED")}
                        className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <CheckCircle2 className="size-3.5" />
                        {locale === "ar" ? "تأكيد الطلب" : "Confirm"}
                      </Button>
                    )}

                    {selectedOrder.status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => handleStatusChange(selectedOrder.id, "PROCESSING")}
                        className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Package className="size-3.5" />
                        {locale === "ar" ? "بدء التجهيز" : "Processing"}
                      </Button>
                    )}

                    {selectedOrder.status === "PROCESSING" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => handleStatusChange(selectedOrder.id, "SHIPPED")}
                        className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Truck className="size-3.5" />
                        {locale === "ar" ? "تسليم لشركة الشحن" : "Ship"}
                      </Button>
                    )}

                    {selectedOrder.status === "SHIPPED" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => handleStatusChange(selectedOrder.id, "DELIVERED")}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Gift className="size-3.5" />
                        {locale === "ar" ? "تم التوصيل ومنح النقاط" : "Delivered & Reward Points"}
                      </Button>
                    )}

                    {selectedOrder.status !== "CANCELLED" &&
                      selectedOrder.status !== "DELIVERED" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => handleStatusChange(selectedOrder.id, "CANCELLED")}
                          className="gap-1.5 text-xs"
                        >
                          <XCircle className="size-3.5" />
                          {locale === "ar"
                            ? "إلغاء الطلب واسترجاع المخزون"
                            : "Cancel & Restore Stock"}
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
