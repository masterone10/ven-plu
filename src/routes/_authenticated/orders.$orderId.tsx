import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelMyOrder } from "@/lib/checkout.functions";
import { getMyOrder } from "@/lib/orders.functions";
import { formatShippingAddress, isCustomerCancellable } from "@/lib/orders-rules";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "VEN+ order details" },
      {
        name: "description",
        content:
          "Your VEN+ order details: items, historical prices, funding mode, totals in EGP or points, shipping and status.",
      },
      { property: "og:title", content: "VEN+ order details" },
      {
        property: "og:description",
        content: "Your VEN+ order summary, historical prices and expected delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

const statusLabels: Record<string, { ar: string; en: string }> = {
  PENDING_CONFIRMATION: { ar: "بانتظار التأكيد", en: "Pending confirmation" },
  CONFIRMED: { ar: "تم التأكيد", en: "Confirmed" },
  PROCESSING: { ar: "قيد التحضير", en: "Processing" },
  SHIPPED: { ar: "تم الشحن", en: "Shipped" },
  DELIVERED: { ar: "تم التسليم", en: "Delivered" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
};

function OrderPage() {
  const { orderId } = Route.useParams();
  const fetchOrder = useServerFn(getMyOrder);
  const cancelOrder = useServerFn(cancelMyOrder);
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder({ data: { orderId } }),
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder({ data: { orderId } }),
    onSuccess: (result) => {
      toast.success(
        locale === "ar"
          ? `تم إلغاء الطلب، وتم استرجاع ${result.refundedPoints} نقطة.`
          : `Order cancelled, ${result.refundedPoints} points refunded.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (mutationError) =>
      toast.error(mutationError instanceof Error ? mutationError.message : "INTERNAL_ERROR"),
  });

  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
          <h1 className="text-xl font-bold">
            {locale === "ar" ? "الطلب غير موجود" : "Order not found"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {locale === "ar"
              ? "هذا الطلب غير متاح لحسابك."
              : "This order is not available for your account."}
          </p>
          <Button asChild className="mt-4" size="sm" variant="secondary">
            <Link to="/orders">{locale === "ar" ? "طلباتي" : "My orders"}</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        {isPending || !data ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-6 text-accent" />
              <h1 className="text-2xl font-black tracking-tight">
                {locale === "ar" ? "تفاصيل الطلب" : "Order details"}
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
              {data.orderNumber} · {dateFormat.format(new Date(data.createdAt))}
            </p>

            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{locale === "ar" ? "الملخص" : "Summary"}</span>
                  <Badge variant="secondary">
                    {statusLabels[data.status]?.[locale] ?? data.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.items.map((item) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span>
                        {locale === "ar" ? item.productName.ar : item.productName.en} ×{" "}
                        {item.quantity}
                      </span>
                      <span>
                        {item.paymentMethod === "POINTS"
                          ? formatPoints(item.linePointsTotal)
                          : formatEGP(item.lineCashTotal)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "ar" ? item.variantName.ar : item.variantName.en}
                      {" · "}
                      <span dir="ltr">{item.sku}</span>
                      {" · "}
                      {locale === "ar" ? "سعر الوحدة: " : "Unit price: "}
                      {item.paymentMethod === "POINTS"
                        ? formatPoints(item.unitPointsPrice)
                        : formatEGP(item.unitCashPrice)}
                    </p>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {locale === "ar" ? "الشحن" : "Shipping"}
                  </span>
                  <span>
                    {data.shippingPaymentMethod === "POINTS"
                      ? formatPoints(data.shippingPointsPrice)
                      : formatEGP(data.shippingCashPrice)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>{locale === "ar" ? "الإجمالي كاش" : "Cash total"}</span>
                  <span>{formatEGP(data.cashTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{locale === "ar" ? "الإجمالي نقاط" : "Points total"}</span>
                  <span>{formatPoints(data.pointsTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar" ? "طريقة التمويل: " : "Funding mode: "}
                  {data.fundingMode}
                  {" · "}
                  {locale === "ar" ? "التسليم المتوقع: " : "Expected delivery: "}
                  {data.expectedDeliveryDuration}
                </p>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar" ? "نقاط مخصومة: " : "Points charged: "}
                  {formatPoints(data.points.pointsCharged)}
                  {" · "}
                  {locale === "ar" ? "نقاط مستردة: " : "Points refunded: "}
                  {formatPoints(data.points.pointsRefunded)}
                  {data.points.pointsEarned > 0 ? (
                    <>
                      {" · "}
                      {locale === "ar" ? "نقاط مكتسبة: " : "Points earned: "}
                      {formatPoints(data.points.pointsEarned)}
                    </>
                  ) : null}
                </p>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {locale === "ar" ? "بيانات التوصيل" : "Shipping information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{data.customerName}</p>
                <p dir="ltr">{data.customerPhone}</p>
                <p>{formatShippingAddress(data.shippingAddress)}</p>
                {data.shippingAddress.notes ? <p>{data.shippingAddress.notes}</p> : null}
                <p>
                  {locale === "ar" ? "طريقة دفع الشحن: " : "Shipping paid with: "}
                  {data.shippingPaymentMethod === "POINTS"
                    ? locale === "ar"
                      ? "نقاط"
                      : "Points"
                    : locale === "ar"
                      ? "كاش"
                      : "Cash"}
                </p>
                {data.deliveredAt ? (
                  <p>
                    {locale === "ar" ? "تاريخ التسليم: " : "Delivered at: "}
                    {dateFormat.format(new Date(data.deliveredAt))}
                  </p>
                ) : null}
                {data.cancelledAt ? (
                  <p>
                    {locale === "ar" ? "تاريخ الإلغاء: " : "Cancelled at: "}
                    {dateFormat.format(new Date(data.cancelledAt))}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link to="/orders">{locale === "ar" ? "طلباتي" : "My orders"}</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link to="/products">{locale === "ar" ? "متابعة الشراء" : "Keep shopping"}</Link>
              </Button>
              {isCustomerCancellable(data.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {locale === "ar" ? "إلغاء الطلب" : "Cancel order"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
