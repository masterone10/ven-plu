import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import { listMyOrders } from "@/lib/orders.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { ORDER_PAGE_SIZE } from "@/lib/orders-rules";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "My VEN+ orders" },
      {
        name: "description",
        content:
          "Every VEN+ order you placed, with its status, cash or points composition and delivery details.",
      },
      { property: "og:title", content: "My VEN+ orders" },
      {
        property: "og:description",
        content: "Track your VEN+ orders, their status and their cash or points totals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersListPage,
});

const statusLabels: Record<string, { ar: string; en: string }> = {
  PENDING_CONFIRMATION: { ar: "بانتظار التأكيد", en: "Pending confirmation" },
  CONFIRMED: { ar: "تم التأكيد", en: "Confirmed" },
  PROCESSING: { ar: "قيد التحضير", en: "Processing" },
  SHIPPED: { ar: "تم الشحن", en: "Shipped" },
  DELIVERED: { ar: "تم التسليم", en: "Delivered" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
};

function OrdersListPage() {
  const fetchOrders = useServerFn(listMyOrders);
  const { locale, t, formatEGP, formatPoints } = useI18n();
  const [page, setPage] = useState(1);

  const { data, isPending } = useQuery({
    queryKey: ["my-orders", page],
    queryFn: () => fetchOrders({ data: { page, pageSize: ORDER_PAGE_SIZE } }),
  });

  const orders = data?.orders ?? [];
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-black tracking-tight">{t("orders")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locale === "ar"
            ? "سجل طلباتك بقيمه المحفوظة وقت الشراء."
            : "Your order history, with the values recorded at purchase time."}
        </p>

        {isPending ? (
          <Loader2 className="mt-8 size-5 animate-spin text-muted-foreground" />
        ) : orders.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <PackageSearch className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {locale === "ar" ? "لا توجد طلبات بعد." : "No orders yet."}
              </p>
              <Button asChild size="sm">
                <Link to="/products">{locale === "ar" ? "تسوّق الآن" : "Start shopping"}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 space-y-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span dir="ltr">{order.orderNumber}</span>
                    <Badge variant="secondary">
                      {statusLabels[order.status]?.[locale] ?? order.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">{dateFormat.format(new Date(order.createdAt))}</p>
                    <p className="text-muted-foreground">
                      {order.itemCount}{" "}
                      {locale === "ar" ? "عنصر" : order.itemCount === 1 ? "item" : "items"}
                      {" · "}
                      {order.fundingMode === "POINTS_ONLY"
                        ? locale === "ar"
                          ? "نقاط"
                          : "Points"
                        : locale === "ar"
                          ? "كاش"
                          : "Cash"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {order.fundingMode === "POINTS_ONLY"
                        ? formatPoints(order.pointsTotal)
                        : formatEGP(order.cashTotal)}
                    </span>
                    <Button asChild variant="secondary" size="sm">
                      <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                        {locale === "ar" ? "التفاصيل" : "Details"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {data && data.pageCount > 1 ? (
          <div className="mt-6 flex items-center justify-between gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              {locale === "ar" ? "السابق" : "Previous"}
            </Button>
            <span className="text-muted-foreground" dir="ltr">
              {data.page} / {data.pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              {locale === "ar" ? "التالي" : "Next"}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
