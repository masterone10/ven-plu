import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  cancelAdminOrder,
  exportAdminOrdersCsv,
  getAdminOrderDetail,
  listAllAdminOrders,
  updateAdminOrderStatus,
  type AdminOrderDetail,
  type AdminOrderRow,
} from "@/lib/admin-orders-list.functions";

const statusLabels: Record<
  string,
  { ar: string; en: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  PENDING_CONFIRMATION: { ar: "بانتظار التأكيد", en: "Pending confirmation", variant: "secondary" },
  CONFIRMED: { ar: "تم التأكيد", en: "Confirmed", variant: "default" },
  PROCESSING: { ar: "قيد التحضير", en: "Processing", variant: "default" },
  SHIPPED: { ar: "تم الشحن", en: "Shipped", variant: "default" },
  DELIVERED: { ar: "تم التسليم", en: "Delivered", variant: "outline" },
  CANCELLED: { ar: "ملغي", en: "Cancelled", variant: "destructive" },
};

const statusSequence: Array<
  "PENDING_CONFIRMATION" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED"
> = ["PENDING_CONFIRMATION", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export function AdminOrdersView() {
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const fetchOrders = useServerFn(listAllAdminOrders);
  const fetchOrderDetail = useServerFn(getAdminOrderDetail);
  const updateStatus = useServerFn(updateAdminOrderStatus);
  const cancelOrder = useServerFn(cancelAdminOrder);
  const exportOrdersCsvFn = useServerFn(exportAdminOrdersCsv);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fundingFilter, setFundingFilter] = useState("ALL");
  const [shippingFilter, setShippingFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportOrdersCsvFn({
        data: {
          status: statusFilter,
          fundingMode: fundingFilter,
          shippingPaymentMethod: shippingFilter,
          search: searchTerm,
        },
      });
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
        locale === "ar" ? "تم تصدير ملف الطلبات بنجاح" : "Orders exported successfully",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export orders");
    } finally {
      setIsExporting(false);
    }
  };

  const {
    data,
    isLoading,
    isError,
    error: queryError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-orders", statusFilter, fundingFilter, shippingFilter, searchTerm, page],
    queryFn: () =>
      fetchOrders({
        data: {
          status: statusFilter,
          fundingMode: fundingFilter,
          shippingPaymentMethod: shippingFilter,
          search: searchTerm,
          page,
          pageSize: 25,
        },
      }),
  });

  const { data: orderDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["admin-order-detail", selectedOrderId],
    queryFn: () =>
      selectedOrderId ? fetchOrderDetail({ data: { orderId: selectedOrderId } }) : null,
    enabled: Boolean(selectedOrderId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (vars: {
      orderId: string;
      newStatus:
        "PENDING_CONFIRMATION" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
    }) => updateStatus({ data: vars }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-order-detail", selectedOrderId] });
      toast.success(
        locale === "ar"
          ? `تم تحديث حالة الطلب إلى: ${statusLabels[res.status]?.[locale] ?? res.status}`
          : `Order status updated to: ${statusLabels[res.status]?.en ?? res.status}`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update order status");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => cancelOrder({ data: { orderId } }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-order-detail", selectedOrderId] });
      toast.success(
        locale === "ar"
          ? `تم إلغاء الطلب بنجاح وتم رد ${res.refundedPoints} نقطة`
          : `Order cancelled successfully, ${res.refundedPoints} points refunded`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order");
    },
  });

  const orders = data?.orders ?? [];
  const totalPages = data?.totalPages ?? 1;

  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    void refetch();
    toast.success(locale === "ar" ? "تم تحديث قائمة الطلبات" : "Orders list refreshed");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">
            {locale === "ar" ? "إدارة ومتابعة طلبات العملاء" : "Customer Orders Management"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {locale === "ar"
              ? "متابعة جميع الطلبات، تحديث حالات الشحن والتسليم، وتوزيع المكافآت التلقائية."
              : "Review all orders, advance shipping and delivery statuses, and audit rewards."}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="gap-2"
          >
            <Download className={`size-3.5 ${isExporting ? "animate-pulse" : ""}`} />
            {locale === "ar" ? "تصدير الطلبات (CSV / Excel)" : "Export Orders CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {locale === "ar" ? "تحديث القائمة" : "Refresh Orders"}
          </Button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={
              locale === "ar"
                ? "بحث برقم الطلب، اسم العميل، الهاتف..."
                : "Search by order #, customer name, phone..."
            }
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="ps-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={locale === "ar" ? "كل الحالات" : "All Statuses"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{locale === "ar" ? "كل الحالات" : "All Statuses"}</SelectItem>
            <SelectItem value="PENDING_CONFIRMATION">
              {locale === "ar" ? "بانتظار التأكيد" : "Pending Confirmation"}
            </SelectItem>
            <SelectItem value="CONFIRMED">
              {locale === "ar" ? "تم التأكيد" : "Confirmed"}
            </SelectItem>
            <SelectItem value="PROCESSING">
              {locale === "ar" ? "قيد التحضير" : "Processing"}
            </SelectItem>
            <SelectItem value="SHIPPED">{locale === "ar" ? "تم الشحن" : "Shipped"}</SelectItem>
            <SelectItem value="DELIVERED">
              {locale === "ar" ? "تم التسليم" : "Delivered"}
            </SelectItem>
            <SelectItem value="CANCELLED">{locale === "ar" ? "ملغي" : "Cancelled"}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={fundingFilter}
          onValueChange={(val) => {
            setFundingFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={locale === "ar" ? "طريقة التمويل" : "Funding Mode"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">
              {locale === "ar" ? "كل طرق التمويل" : "All Funding"}
            </SelectItem>
            <SelectItem value="CASH_ONLY">{locale === "ar" ? "كاش فقط" : "Cash Only"}</SelectItem>
            <SelectItem value="POINTS_ONLY">
              {locale === "ar" ? "نقاط فقط" : "Points Only"}
            </SelectItem>
            <SelectItem value="MIXED">{locale === "ar" ? "مختلط" : "Mixed"}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={shippingFilter}
          onValueChange={(val) => {
            setShippingFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={locale === "ar" ? "دفع الشحن" : "Shipping Pay"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">
              {locale === "ar" ? "كل دفع الشحن" : "All Shipping Pay"}
            </SelectItem>
            <SelectItem value="CASH">{locale === "ar" ? "شحن كاش" : "Shipping Cash"}</SelectItem>
            <SelectItem value="POINTS">
              {locale === "ar" ? "شحن نقاط" : "Shipping Points"}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-base font-semibold text-destructive">
              {locale === "ar" ? "خطأ في تحميل قائمة الطلبات" : "Failed to load orders"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {queryError instanceof Error ? queryError.message : "Internal error"}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4 gap-2">
              <RefreshCw className="size-3.5" />
              {locale === "ar" ? "إعادة المحاولة" : "Try Again"}
            </Button>
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="size-10 text-muted-foreground" />
            <p className="mt-4 text-base font-semibold">
              {locale === "ar" ? "لا توجد طلبات مطابقة" : "No matching orders found"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "ar"
                ? "جرّب تغيير فلاتر البحث أو الحالة."
                : "Try adjusting your search or status filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">
                    {locale === "ar" ? "رقم الطلب" : "Order #"}
                  </th>
                  <th className="px-4 py-3 text-start">
                    {locale === "ar" ? "العميل" : "Customer"}
                  </th>
                  <th className="px-4 py-3 text-start">{locale === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3 text-start">{locale === "ar" ? "العناصر" : "Items"}</th>
                  <th className="px-4 py-3 text-start">{locale === "ar" ? "الإجمالي" : "Total"}</th>
                  <th className="px-4 py-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end">
                    {locale === "ar" ? "الإجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const statusInfo = statusLabels[order.status] ?? {
                    ar: order.status,
                    en: order.status,
                    variant: "secondary" as const,
                  };
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-foreground" dir="ltr">
                          {order.orderNumber}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          <div className="font-semibold text-foreground">{order.customerName}</div>
                          <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                            {order.customerPhone}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {dateFormat.format(new Date(order.createdAt))}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">
                          {order.itemCount} {locale === "ar" ? "عنصر" : "items"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {order.cashTotal > 0 && <div>{formatEGP(order.cashTotal)}</div>}
                          {order.pointsTotal > 0 && (
                            <div className="text-xs text-primary font-mono">
                              {formatPoints(order.pointsTotal)}
                            </div>
                          )}
                          {order.cashTotal === 0 && order.pointsTotal === 0 && (
                            <span className="text-xs text-muted-foreground">0 EGP</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant} className="text-xs">
                          {statusInfo[locale]}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="gap-1 text-xs"
                        >
                          <Eye className="size-3.5" />
                          {locale === "ar" ? "عرض وتحديث" : "View & Update"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {locale === "ar" ? "السابق" : "Previous"}
          </Button>
          <span dir="ltr">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {locale === "ar" ? "التالي" : "Next"}
          </Button>
        </div>
      )}

      {/* Order Detail & Update Modal */}
      {selectedOrderId && (
        <Dialog open onOpenChange={() => setSelectedOrderId(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-3 text-lg">
                <span className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  {locale === "ar" ? "تفاصيل الطلب:" : "Order Details:"}{" "}
                  <span className="font-mono" dir="ltr">
                    {orderDetail?.orderNumber || "..."}
                  </span>
                </span>
                {orderDetail && (
                  <Badge
                    variant={statusLabels[orderDetail.status]?.variant ?? ("secondary" as const)}
                  >
                    {statusLabels[orderDetail.status]?.[locale] ?? orderDetail.status}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {orderDetail &&
                  `${locale === "ar" ? "تاريخ الطلب: " : "Placed on: "} ${dateFormat.format(
                    new Date(orderDetail.createdAt),
                  )}`}
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetail || !orderDetail ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Update Quick Bar */}
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {locale === "ar" ? "تحديث حالة الطلب" : "Update Order Status"}
                  </h4>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {statusSequence.map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={orderDetail.status === st ? "default" : "outline"}
                        disabled={
                          orderDetail.status === "CANCELLED" ||
                          updateStatusMutation.isPending ||
                          orderDetail.status === st
                        }
                        onClick={() =>
                          updateStatusMutation.mutate({
                            orderId: orderDetail.id,
                            newStatus: st,
                          })
                        }
                        className="text-xs"
                      >
                        {statusLabels[st]?.[locale] ?? st}
                      </Button>
                    ))}

                    {orderDetail.status !== "CANCELLED" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(orderDetail.id)}
                        className="ms-auto text-xs gap-1"
                      >
                        <Ban className="size-3.5" />
                        {locale === "ar" ? "إلغاء الطلب وتعويض النقاط" : "Cancel & Refund Points"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Customer and Delivery Information */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <User className="size-4 text-primary" />
                      {locale === "ar" ? "بيانات العميل" : "Customer Details"}
                    </h4>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        <strong className="text-foreground">{orderDetail.customerName}</strong>
                      </p>
                      <p dir="ltr">
                        {locale === "ar" ? "الهاتف الأساسي: " : "Phone: "}
                        <span className="font-mono text-foreground">
                          {orderDetail.customerPhone}
                        </span>
                      </p>
                      {orderDetail.shippingAddress?.secondaryPhone && (
                        <p dir="ltr">
                          {locale === "ar" ? "هاتف إضافي: " : "Secondary: "}
                          <span className="font-mono text-foreground">
                            {orderDetail.shippingAddress.secondaryPhone}
                          </span>
                        </p>
                      )}
                      {orderDetail.shippingAddress?.whatsApp && (
                        <p dir="ltr">
                          {locale === "ar" ? "واتساب: " : "WhatsApp: "}
                          <span className="font-mono text-foreground">
                            {orderDetail.shippingAddress.whatsApp}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Truck className="size-4 text-primary" />
                      {locale === "ar" ? "عنوان وملاحظات التوصيل" : "Delivery Address & Notes"}
                    </h4>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        {orderDetail.shippingAddress?.governorate} —{" "}
                        {orderDetail.shippingAddress?.city}
                      </p>
                      <p>{orderDetail.shippingAddress?.street}</p>
                      {orderDetail.expectedDeliveryDuration && (
                        <p className="text-xs font-medium text-foreground">
                          {locale === "ar" ? "مدة التوصيل المتوقعة: " : "Estimated Delivery: "}
                          <Badge variant="outline" className="text-[11px] font-normal ms-1">
                            {orderDetail.expectedDeliveryDuration}
                          </Badge>
                        </p>
                      )}
                      {orderDetail.shippingAddress?.notes && (
                        <p className="rounded bg-muted p-1.5 text-[11px] text-foreground mt-1">
                          {orderDetail.shippingAddress.notes}
                        </p>
                      )}
                      {orderDetail.notes && (
                        <p className="text-[11px] italic text-muted-foreground mt-1">
                          {locale === "ar" ? "ملاحظات إضافية: " : "Order Notes: "}
                          {orderDetail.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Funding & Payment Summary */}
                <div className="flex flex-wrap gap-3 p-3 rounded-lg border border-border bg-muted/10 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "نمط التمويل:" : "Funding Mode:"}
                    </span>
                    <Badge variant="secondary" className="font-mono">
                      {orderDetail.fundingMode}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "دفع الشحن:" : "Shipping Payment:"}
                    </span>
                    <Badge variant="secondary" className="font-mono">
                      {orderDetail.shippingPaymentMethod}
                    </Badge>
                  </div>
                </div>

                {/* Items Breakdown */}
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-bold text-foreground">
                    {locale === "ar" ? "عناصر الطلب" : "Order Items"}
                  </h4>
                  <div className="mt-3 divide-y divide-border">
                    {orderDetail.items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-foreground">
                            {locale === "ar" ? item.productNameAr : item.productNameEn} ×{" "}
                            {item.quantity}
                          </div>
                          <div className="text-muted-foreground">
                            {locale === "ar" ? item.variantNameAr : item.variantNameEn}
                            {" · "}
                            <span className="font-mono">{item.sku}</span>
                            {" · "}
                            <Badge variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                              {item.productPaymentMethod}
                            </Badge>
                            {item.productPaymentMethod === "POINTS" &&
                            item.unitPointsPrice != null ? (
                              <span className="ms-1.5 font-mono">
                                ({formatPoints(item.unitPointsPrice)} / unit)
                              </span>
                            ) : (
                              <span className="ms-1.5 font-mono">
                                ({formatEGP(item.unitCashPrice)} / unit)
                              </span>
                            )}
                          </div>
                          {item.deliveryPointsReward > 0 && (
                            <div className="text-[11px] text-primary mt-0.5">
                              {locale === "ar"
                                ? `مكافأة استلام: +${item.deliveryPointsReward} نقطة`
                                : `Delivery reward: +${item.deliveryPointsReward} pts`}
                            </div>
                          )}
                        </div>
                        <div className="text-end font-medium text-foreground">
                          {item.productPaymentMethod === "POINTS"
                            ? formatPoints(item.linePointsTotal)
                            : formatEGP(item.lineCashTotal)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-3" />

                  {/* Totals */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{locale === "ar" ? "رسوم الشحن:" : "Shipping Fee:"}</span>
                      <span>
                        {orderDetail.shippingPaymentMethod === "POINTS"
                          ? formatPoints(orderDetail.shippingPointsPrice)
                          : formatEGP(orderDetail.shippingCashPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground text-sm pt-1">
                      <span>{locale === "ar" ? "الإجمالي كاش:" : "Total Cash:"}</span>
                      <span>{formatEGP(orderDetail.cashTotal)}</span>
                    </div>
                    {orderDetail.pointsTotal > 0 && (
                      <div className="flex justify-between font-bold text-primary text-sm">
                        <span>{locale === "ar" ? "الإجمالي نقاط:" : "Total Points:"}</span>
                        <span>{formatPoints(orderDetail.pointsTotal)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Points Transactions History */}
                {orderDetail.pointsTransactions.length > 0 && (
                  <div className="rounded-lg border border-border p-4">
                    <h4 className="text-sm font-bold text-foreground">
                      {locale === "ar"
                        ? "حركات النقاط المرتبطة بالطلب"
                        : "Associated Points Ledger"}
                    </h4>
                    <div className="mt-2 space-y-2">
                      {orderDetail.pointsTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-xs rounded bg-muted/30 p-2"
                        >
                          <div>
                            <span className="font-mono font-medium text-foreground">{tx.type}</span>
                            {tx.note && (
                              <span className="ms-2 text-muted-foreground">({tx.note})</span>
                            )}
                          </div>
                          <Badge
                            variant={tx.delta > 0 ? "default" : "secondary"}
                            className="font-mono"
                          >
                            {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSelectedOrderId(null)}>
                {locale === "ar" ? "إغلاق" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
