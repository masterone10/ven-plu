import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCart } from "@/lib/cart.functions";
import { placeOrder } from "@/lib/checkout.functions";
import { checkoutFingerprint, isPointsShippingUnlocked } from "@/lib/checkout-rules";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/points-rules";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "VEN+ checkout — cash or points" },
      {
        name: "description",
        content:
          "Confirm your delivery details and place your VEN+ order, paying entirely in EGP or entirely with points.",
      },
      { property: "og:title", content: "VEN+ checkout" },
      { property: "og:description", content: "Place your VEN+ order in EGP or with points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const fetchCart = useServerFn(getCart);
  const submitOrder = useServerFn(placeOrder);
  const { locale, formatEGP, formatPoints } = useI18n();
  const router = useRouter();

  const { data, isPending } = useQuery({ queryKey: ["cart"], queryFn: () => fetchCart() });

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingMethod, setShippingMethod] = useState<PaymentMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(`co_${crypto.randomUUID()}`);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const settings = data?.settings;
  const balance = data?.pointsBalance ?? 0;

  const pointsShippingCost = settings?.shippingPointsPrice ?? 400;
  const cashShippingCost = settings?.globalShippingPrice ?? 80;
  const hasEnoughPointsForShipping = balance >= pointsShippingCost;

  const preview = useMemo(() => {
    const cashItems = items.reduce((sum, item) => sum + item.lineCashTotal, 0);
    const pointsItems = items.reduce((sum, item) => sum + item.linePointsTotal, 0);
    const shippingCash = shippingMethod === "CASH" ? cashShippingCost : 0;
    const shippingPoints = shippingMethod === "POINTS" ? pointsShippingCost : 0;
    return {
      cashItems,
      pointsItems,
      shippingCash,
      shippingPoints,
      cashTotal: Math.round((cashItems + shippingCash) * 100) / 100,
      pointsTotal: pointsItems + shippingPoints,
    };
  }, [items, cashShippingCost, pointsShippingCost, shippingMethod]);

  const hasInsufficientPoints = preview.pointsTotal > balance;
  const blocked =
    items.length === 0 || items.some((item) => item.issue !== null) || hasInsufficientPoints;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const shippingAddress = { governorate, city, street, notes };
      const fingerprint = checkoutFingerprint({
        shippingPaymentMethod: shippingMethod,
        customerName,
        customerPhone,
        shippingAddress,
        lines: items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          paymentMethod: item.paymentMethod,
        })),
      });

      const result = await submitOrder({
        data: {
          idempotencyKey: idempotencyKey.current,
          customerName,
          customerPhone,
          shippingAddress,
          shippingPaymentMethod: shippingMethod,
          fingerprint,
        },
      });

      await router.navigate({ to: "/orders/$orderId", params: { orderId: result.orderId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "INTERNAL_ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {locale === "ar" ? "بيانات التوصيل" : "Delivery details"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="name">{locale === "ar" ? "الاسم" : "Name"}</Label>
                <Input
                  id="name"
                  required
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{locale === "ar" ? "رقم الموبايل" : "Mobile number"}</Label>
                <Input
                  id="phone"
                  required
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="01XXXXXXXXX"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gov">{locale === "ar" ? "المحافظة" : "Governorate"}</Label>
                  <Input
                    id="gov"
                    required
                    value={governorate}
                    onChange={(event) => setGovernorate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">{locale === "ar" ? "المدينة" : "City"}</Label>
                  <Input
                    id="city"
                    required
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="street">{locale === "ar" ? "العنوان" : "Street address"}</Label>
                <Input
                  id="street"
                  required
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{locale === "ar" ? "طريقة دفع الشحن" : "Shipping payment method"}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={shippingMethod === "CASH" ? "default" : "outline"}
                    onClick={() => setShippingMethod("CASH")}
                  >
                    {locale === "ar"
                      ? `كاش (${formatEGP(cashShippingCost)})`
                      : `Cash (${formatEGP(cashShippingCost)})`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={shippingMethod === "POINTS" ? "default" : "outline"}
                    disabled={!hasEnoughPointsForShipping}
                    onClick={() => setShippingMethod("POINTS")}
                  >
                    {locale === "ar"
                      ? `نقاط (${formatPoints(pointsShippingCost)})`
                      : `Points (${formatPoints(pointsShippingCost)})`}
                  </Button>
                </div>
                {shippingMethod === "POINTS" ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {locale === "ar"
                      ? `الشحن مجاني كاش ويتم خصم ${formatPoints(pointsShippingCost)} من رصيدك.`
                      : `Shipping is cash-free and ${formatPoints(pointsShippingCost)} will be deducted from your balance.`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? `تكلفة الشحن كاش: ${formatEGP(cashShippingCost)}.`
                      : `Cash shipping cost: ${formatEGP(cashShippingCost)}.`}
                  </p>
                )}
                {!hasEnoughPointsForShipping && shippingMethod !== "POINTS" ? (
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? `الدفع بالنقاط للشحن يتطلب ${formatPoints(pointsShippingCost)} (رصيدك الحالي: ${formatPoints(balance)}).`
                      : `Points shipping requires ${formatPoints(pointsShippingCost)} (your balance: ${formatPoints(balance)}).`}
                  </p>
                ) : null}
              </div>

              {hasInsufficientPoints ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                  {locale === "ar"
                    ? `رصيد نقاطك (${formatPoints(balance)}) غير كافٍ لتغطية إجمالي النقاط المطلوب (${formatPoints(preview.pointsTotal)}).`
                    : `Your points balance (${formatPoints(balance)}) is insufficient for the required total (${formatPoints(preview.pointsTotal)}).`}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={busy || blocked || isPending}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {locale === "ar" ? "تأكيد الطلب" : "Place order"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">{locale === "ar" ? "طلبك" : "Your order"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {locale === "ar" ? item.productNameAr : item.productNameEn} × {item.quantity}
                </span>
                <span>
                  {item.paymentMethod === "POINTS"
                    ? formatPoints(item.linePointsTotal)
                    : formatEGP(item.lineCashTotal)}
                </span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {locale === "ar" ? "الشحن" : "Shipping"}
              </span>
              <span>
                {shippingMethod === "POINTS"
                  ? formatPoints(preview.shippingPoints)
                  : formatEGP(preview.shippingCash)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{locale === "ar" ? "الإجمالي كاش" : "Cash total"}</span>
              <span>{formatEGP(preview.cashTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{locale === "ar" ? "الإجمالي نقاط" : "Points total"}</span>
              <span>{formatPoints(preview.pointsTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "مدة التسليم المتوقعة: " : "Expected delivery: "}
              {settings?.expectedDeliveryDuration}
            </p>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to="/cart">{locale === "ar" ? "رجوع للسلة" : "Back to cart"}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
