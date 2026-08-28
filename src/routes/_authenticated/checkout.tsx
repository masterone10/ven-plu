import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  Coins,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
  type CartItemView,
} from "@/lib/cart.functions";
import { listCatalog, type CatalogProduct, type CatalogVariant } from "@/lib/catalog.functions";
import { placeOrder } from "@/lib/checkout.functions";
import { checkoutFingerprint } from "@/lib/checkout-rules";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
          "Confirm your delivery details and place your VEN+ order, paying in cash or with points.",
      },
      { property: "og:title", content: "VEN+ checkout" },
      {
        property: "og:description",
        content: "Place your VEN+ order with independent cash and points payment options.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const fetchCart = useServerFn(getCart);
  const fetchCatalog = useServerFn(listCatalog);
  const submitOrder = useServerFn(placeOrder);
  const addCart = useServerFn(addCartItem);
  const updateCart = useServerFn(updateCartItem);
  const removeCart = useServerFn(removeCartItem);

  const { locale, formatEGP, formatPoints } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: cartData, isPending: isCartPending } = useQuery({
    queryKey: ["cart"],
    queryFn: () => fetchCart(),
  });

  const { data: catalogData } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => fetchCatalog(),
  });

  // Delivery fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingMethod, setShippingMethod] = useState<PaymentMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(`co_${crypto.randomUUID()}`);

  // In-checkout search state
  const [searchQuery, setSearchQuery] = useState("");

  const items = useMemo(() => cartData?.items ?? [], [cartData?.items]);
  const settings = cartData?.settings;
  const balance = cartData?.pointsBalance ?? 0;

  const pointsShippingCost = settings?.shippingPointsPrice ?? 400;
  const cashShippingCost = settings?.globalShippingPrice ?? 80;
  const hasEnoughPointsForShipping = balance >= pointsShippingCost;

  const preview = useMemo(() => {
    const cashItems = items.reduce((sum, item) => sum + item.lineCashTotal, 0);
    const pointsItems = items.reduce((sum, item) => sum + item.linePointsTotal, 0);
    const shippingCash = shippingMethod === "CASH" ? cashShippingCost : 0;
    const shippingPoints = shippingMethod === "POINTS" ? pointsShippingCost : 0;
    const cashTotal = Math.round((cashItems + shippingCash) * 100) / 100;
    const pointsTotal = pointsItems + shippingPoints;
    const pointsRemaining = balance - pointsTotal;

    return {
      cashItems,
      pointsItems,
      shippingCash,
      shippingPoints,
      cashTotal,
      pointsTotal,
      pointsRemaining,
    };
  }, [items, cashShippingCost, pointsShippingCost, shippingMethod, balance]);

  const hasInsufficientPoints = preview.pointsTotal > balance;
  const blocked =
    items.length === 0 || items.some((item) => item.issue !== null) || hasInsufficientPoints;

  const invalidateCart = () => void queryClient.invalidateQueries({ queryKey: ["cart"] });

  const updateMutation = useMutation({
    mutationFn: (input: { itemId: string; quantity?: number; paymentMethod?: PaymentMethod }) =>
      updateCart({ data: input }),
    onSuccess: invalidateCart,
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "INTERNAL_ERROR"),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCart({ data: { itemId } }),
    onSuccess: invalidateCart,
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "INTERNAL_ERROR"),
  });

  // Filter catalog for in-checkout quick product picker
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !catalogData) return [];
    return catalogData
      .filter(
        (p) =>
          p.nameAr.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.variants.some(
            (v) => v.sku.toLowerCase().includes(q) || v.nameAr.toLowerCase().includes(q),
          ),
      )
      .slice(0, 8);
  }, [searchQuery, catalogData]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const shippingAddress = {
        address,
        street: address,
        secondaryPhone,
        notes,
      };

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
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              {locale === "ar" ? "إتمام الطلب" : "Checkout"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "أدخل بيانات التوصيل وأكّد طلبك بكل سهولة."
                : "Enter your delivery details and place your order."}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/cart">
              <ShoppingCart className="me-2 size-4" />
              {locale === "ar" ? "عرض السلة الكاملة" : "View full cart"}
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Left Column: Delivery Details & Quick Product Picker */}
          <div className="space-y-6">
            {/* Delivery Details Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="size-5 text-accent" />
                  {locale === "ar" ? "بيانات التوصيل" : "Delivery details"}
                </CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "الرجاء كتابة الاسم ورقم الهاتف والعنوان بدقة."
                    : "Please provide your name, mobile number and complete street address."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form id="checkout-form" className="space-y-4" onSubmit={onSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="checkout-name" className="text-xs font-semibold">
                        {locale === "ar" ? "الاسم *" : "Full name *"}
                      </Label>
                      <Input
                        id="checkout-name"
                        required
                        minLength={2}
                        placeholder={locale === "ar" ? "الاسم ثلاثي أو ثنائي" : "Full name"}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="checkout-phone" className="text-xs font-semibold">
                        {locale === "ar" ? "رقم الموبايل *" : "Mobile number *"}
                      </Label>
                      <Input
                        id="checkout-phone"
                        required
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="01XXXXXXXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-secondary-phone" className="text-xs font-semibold">
                      {locale === "ar" ? "رقم هاتف ثانٍ (اختياري)" : "Secondary phone (optional)"}
                    </Label>
                    <Input
                      id="checkout-secondary-phone"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="01XXXXXXXXX"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-address" className="text-xs font-semibold">
                      {locale === "ar" ? "العنوان بالتفصيل *" : "Full Street Address *"}
                    </Label>
                    <Input
                      id="checkout-address"
                      required
                      minLength={3}
                      placeholder={
                        locale === "ar"
                          ? "اسم الشارع، رقم المبنى، الشقة، علامة مميزة..."
                          : "Street name, building number, apartment, landmark..."
                      }
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-notes" className="text-xs font-semibold">
                      {locale === "ar" ? "ملاحظات إضافية للتوصيل" : "Delivery notes"}
                    </Label>
                    <Input
                      id="checkout-notes"
                      placeholder={
                        locale === "ar"
                          ? "أي تعليمات خاصة للمندوب عند التسليم..."
                          : "Special instructions for the courier..."
                      }
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <Separator />

                  {/* Shipping Payment Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Truck className="size-4 text-accent" />
                      {locale === "ar" ? "طريقة دفع الشحن" : "Shipping payment method"}
                    </Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        className={`flex flex-col items-start justify-between rounded-lg border p-3 text-start transition-colors ${
                          shippingMethod === "CASH"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => setShippingMethod("CASH")}
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <CreditCard className="size-4 text-muted-foreground" />
                          <span>{locale === "ar" ? "دفع الشحن كاش" : "Pay shipping cash"}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatEGP(cashShippingCost)}
                        </p>
                      </button>

                      <button
                        type="button"
                        disabled={!hasEnoughPointsForShipping}
                        className={`flex flex-col items-start justify-between rounded-lg border p-3 text-start transition-colors ${
                          shippingMethod === "POINTS"
                            ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                            : !hasEnoughPointsForShipping
                              ? "cursor-not-allowed opacity-50 border-border"
                              : "border-border hover:bg-muted/50"
                        }`}
                        onClick={() => setShippingMethod("POINTS")}
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <Coins className="size-4 text-amber-500" />
                          <span>
                            {locale === "ar" ? "دفع الشحن بالنقاط" : "Pay shipping with points"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatPoints(pointsShippingCost)}
                        </p>
                      </button>
                    </div>

                    {shippingMethod === "POINTS" ? (
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {locale === "ar"
                          ? `✓ الشحن مجاني كاش ويتم خصم ${formatPoints(pointsShippingCost)} من رصيدك.`
                          : `✓ Free cash shipping; ${formatPoints(pointsShippingCost)} deducted from points.`}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {locale === "ar"
                          ? `تكلفة الشحن كاش تضاف للإجمالي: ${formatEGP(cashShippingCost)}.`
                          : `Cash shipping cost added to total: ${formatEGP(cashShippingCost)}.`}
                      </p>
                    )}

                    {!hasEnoughPointsForShipping && shippingMethod !== "POINTS" ? (
                      <p className="text-xs text-muted-foreground">
                        {locale === "ar"
                          ? `الدفع بالنقاط للشحن يتطلب ${formatPoints(pointsShippingCost)} (رصيدك الحالي: ${formatPoints(balance)}).`
                          : `Points shipping requires ${formatPoints(pointsShippingCost)} (balance: ${formatPoints(balance)}).`}
                      </p>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* In-Checkout Product Search & Quick Add Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="size-4 text-accent" />
                  {locale === "ar" ? "إضافة منتجات للطلب" : "Add products to order"}
                </CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "ابحث باسم المنتج أو الكود لإضافته مباشرة إلى طلبك الحالي."
                    : "Search by product name or SKU to quickly add items to your checkout."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={
                      locale === "ar"
                        ? "ابحث باسم المنتج أو كود SKU..."
                        : "Search product name or SKU..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9"
                  />
                </div>

                {searchQuery.trim().length > 0 ? (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    {searchResults.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        {locale === "ar"
                          ? "لا توجد منتجات مطابقة للبحث."
                          : "No matching products found."}
                      </p>
                    ) : (
                      searchResults.map((prod) => (
                        <InCheckoutProductPickerRow
                          key={prod.id}
                          product={prod}
                          onAdd={async (variantId, quantity, paymentMethod) => {
                            await addCart({ data: { variantId, quantity, paymentMethod } });
                            invalidateCart();
                            toast.success(
                              locale === "ar" ? "تمت إضافة المنتج للطلب" : "Product added to order",
                            );
                          }}
                        />
                      ))
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary & Review */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <Package className="size-5 text-accent" />
                    {locale === "ar" ? "محتويات الطلب" : "Order items"}
                  </span>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCartPending ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin me-2" />
                    {locale === "ar" ? "جاري تحميل المنتجات..." : "Loading items..."}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p>
                      {locale === "ar" ? "السلة فارغة حالياً." : "Your cart is currently empty."}
                    </p>
                    <Button asChild variant="link" size="sm" className="mt-2">
                      <Link to="/products">
                        {locale === "ar" ? "تصفح المنتجات" : "Browse products"}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <CheckoutItemRow
                        key={item.id}
                        item={item}
                        busy={updateMutation.isPending || removeMutation.isPending}
                        onQuantity={(qty) =>
                          updateMutation.mutate({ itemId: item.id, quantity: qty })
                        }
                        onMethod={(method) =>
                          updateMutation.mutate({ itemId: item.id, paymentMethod: method })
                        }
                        onRemove={() => removeMutation.mutate(item.id)}
                      />
                    ))}
                  </div>
                )}

                <Separator />

                {/* Financial Summary */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "إجمالي المنتجات (كاش)" : "Products subtotal (cash)"}
                    </span>
                    <span className="font-medium">{formatEGP(preview.cashItems)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "إجمالي المنتجات (نقاط)" : "Products subtotal (points)"}
                    </span>
                    <span className="font-medium">{formatPoints(preview.pointsItems)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "تكلفة الشحن" : "Shipping fee"}
                    </span>
                    <span className="font-medium">
                      {shippingMethod === "POINTS"
                        ? formatPoints(preview.shippingPoints)
                        : formatEGP(preview.shippingCash)}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-base font-bold text-foreground">
                    <span>{locale === "ar" ? "إجمالي الكاش المطلوب" : "Total Cash Due"}</span>
                    <span className="text-primary">{formatEGP(preview.cashTotal)}</span>
                  </div>

                  <div className="flex justify-between text-base font-bold text-foreground">
                    <span>{locale === "ar" ? "إجمالي النقاط المطلوبة" : "Total Points Due"}</span>
                    <span className="text-accent">{formatPoints(preview.pointsTotal)}</span>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {locale === "ar" ? "رصيدك الحالي من النقاط:" : "Current points balance:"}
                      </span>
                      <span className="font-semibold">{formatPoints(balance)}</span>
                    </div>
                    {preview.pointsTotal > 0 ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          {locale === "ar" ? "الرصيد بعد تنفيذ الطلب:" : "Balance after order:"}
                        </span>
                        <span
                          className={
                            preview.pointsRemaining < 0
                              ? "text-destructive font-bold"
                              : "font-semibold"
                          }
                        >
                          {formatPoints(Math.max(0, preview.pointsRemaining))}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {hasInsufficientPoints ? (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                      {locale === "ar"
                        ? `رصيد نقاطك (${formatPoints(balance)}) غير كافٍ لتغطية إجمالي النقاط المطلوب (${formatPoints(preview.pointsTotal)}).`
                        : `Your points balance (${formatPoints(balance)}) is insufficient for the required total (${formatPoints(preview.pointsTotal)}).`}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    form="checkout-form"
                    className="mt-4 w-full h-11 text-base font-bold"
                    disabled={busy || blocked || isCartPending}
                  >
                    {busy ? <Loader2 className="me-2 size-5 animate-spin" /> : null}
                    {locale === "ar" ? "تأكيد الطلب الآن" : "Confirm & Place Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function CheckoutItemRow({
  item,
  busy,
  onQuantity,
  onMethod,
  onRemove,
}: {
  item: CartItemView;
  busy: boolean;
  onQuantity: (qty: number) => void;
  onMethod: (method: PaymentMethod) => void;
  onRemove: () => void;
}) {
  const { locale, formatEGP, formatPoints } = useI18n();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 text-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={locale === "ar" ? item.productNameAr : item.productNameEn}
            className="size-12 rounded-md object-cover border"
          />
        ) : (
          <div className="size-12 rounded-md bg-muted flex items-center justify-center border">
            <Package className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground text-xs">
            {locale === "ar" ? item.productNameAr : item.productNameEn}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {locale === "ar" ? item.variantNameAr : item.variantNameEn}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge
              variant={item.paymentMethod === "POINTS" ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0 cursor-pointer"
              onClick={() => {
                if (item.pointsEnabled) {
                  onMethod(item.paymentMethod === "POINTS" ? "CASH" : "POINTS");
                }
              }}
            >
              {item.paymentMethod === "POINTS"
                ? locale === "ar"
                  ? "نقاط"
                  : "Points"
                : locale === "ar"
                  ? "كاش"
                  : "Cash"}
            </Badge>
            <span className="font-semibold text-foreground">
              {item.paymentMethod === "POINTS"
                ? formatPoints(item.linePointsTotal)
                : formatEGP(item.lineCashTotal)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center rounded border bg-background">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 h-6 w-6"
            disabled={busy || item.quantity <= 1}
            onClick={() => onQuantity(item.quantity - 1)}
          >
            <Minus className="size-3" />
          </Button>
          <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 h-6 w-6"
            disabled={busy || item.quantity >= item.stock}
            onClick={() => onQuantity(item.quantity + 1)}
          >
            <Plus className="size-3" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 h-6 w-6 text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function InCheckoutProductPickerRow({
  product,
  onAdd,
}: {
  product: CatalogProduct;
  onAdd: (variantId: string, quantity: number, paymentMethod: PaymentMethod) => Promise<void>;
}) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [loading, setLoading] = useState(false);

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={locale === "ar" ? product.nameAr : product.nameEn}
            className="size-10 rounded object-cover border"
          />
        ) : (
          <div className="size-10 rounded bg-muted flex items-center justify-center border">
            <Package className="size-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">
            {locale === "ar" ? product.nameAr : product.nameEn}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {method === "POINTS" && product.pointsEnabled && selectedVariant?.pointsPrice
              ? formatPoints(selectedVariant.pointsPrice)
              : formatEGP(selectedVariant?.cashPrice ?? product.cashPrice)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {product.variants.length > 1 ? (
          <select
            className="h-7 rounded border bg-background px-1.5 text-xs"
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {locale === "ar" ? v.nameAr : v.nameEn} ({v.sku})
              </option>
            ))}
          </select>
        ) : null}

        {product.pointsEnabled ? (
          <div className="flex rounded border bg-muted/30 p-0.5">
            <button
              type="button"
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                method === "CASH"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMethod("CASH")}
            >
              {locale === "ar" ? "كاش" : "Cash"}
            </button>
            <button
              type="button"
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                method === "POINTS"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMethod("POINTS")}
            >
              {locale === "ar" ? "نقاط" : "Points"}
            </button>
          </div>
        ) : null}

        <div className="flex items-center rounded border bg-background">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 h-6 w-6"
            disabled={qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-2.5" />
          </Button>
          <span className="w-4 text-center text-xs font-semibold">{qty}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 h-6 w-6"
            disabled={qty >= (selectedVariant?.stock ?? 10)}
            onClick={() => setQty((q) => q + 1)}
          >
            <Plus className="size-2.5" />
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={loading || !selectedVariant || selectedVariant.stock <= 0}
          onClick={async () => {
            if (!selectedVariant) return;
            setLoading(true);
            try {
              await onAdd(selectedVariant.id, qty, method);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3 me-1" />}
          {locale === "ar" ? "إضافة" : "Add"}
        </Button>
      </div>
    </div>
  );
}
