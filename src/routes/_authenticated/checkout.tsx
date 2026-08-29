import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Coins,
  Loader2,
  Minus,
  Package,
  Plus,
  PlusCircle,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { addCartItem, getCart, removeCartItem, updateCartItem } from "@/lib/cart.functions";
import { placeOrder } from "@/lib/checkout.functions";
import { listCatalog, type CatalogProduct, type CatalogVariant } from "@/lib/catalog.functions";
import { checkoutFingerprint } from "@/lib/checkout-rules";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/points-rules";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "VEN+ Checkout — Cash or Points" },
      {
        name: "description",
        content:
          "Confirm your delivery details and place your VEN+ order with flexible payment in Cash or Points.",
      },
      { property: "og:title", content: "VEN+ Checkout" },
      { property: "og:description", content: "Place your VEN+ order in EGP or with points." },
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
  const addItem = useServerFn(addCartItem);
  const updateItem = useServerFn(updateCartItem);
  const deleteItem = useServerFn(removeCartItem);

  const queryClient = useQueryClient();
  const { locale, formatEGP, formatPoints, t } = useI18n();
  const router = useRouter();

  const { data: cartData, isPending: isCartPending } = useQuery({
    queryKey: ["cart"],
    queryFn: () => fetchCart(),
  });
  const { data: catalogData } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => fetchCatalog(),
  });

  // Delivery Form State (strictly: Name, Phone, Secondary Phone, Address, Notes)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingMethod, setShippingMethod] = useState<PaymentMethod>("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search #2 Modal / Sheet State
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [checkoutSearch, setCheckoutSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [addProductQuantity, setAddProductQuantity] = useState(1);
  const [addProductMethod, setAddProductMethod] = useState<PaymentMethod>("CASH");
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const idempotencyKey = useRef(`co_${crypto.randomUUID()}`);
  const hasPrefilledRef = useRef(false);

  useEffect(() => {
    if (!hasPrefilledRef.current && cartData?.customerDefaults) {
      const defs = cartData.customerDefaults;
      setCustomerName((prev) => (prev ? prev : defs.fullName));
      setCustomerPhone((prev) => (prev ? prev : defs.phone));
      setSecondaryPhone((prev) => (prev ? prev : defs.secondaryPhone));
      setAddress((prev) => (prev ? prev : defs.address));
      setNotes((prev) => (prev ? prev : defs.notes));
      hasPrefilledRef.current = true;
    }
  }, [cartData?.customerDefaults]);

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
  const isBlocked =
    items.length === 0 || items.some((item) => item.issue !== null) || hasInsufficientPoints;

  // Filter products for Search #2
  const searchResults = useMemo(() => {
    const catalog = catalogData ?? [];
    if (!checkoutSearch.trim()) return catalog.slice(0, 12);
    const q = checkoutSearch.trim().toLowerCase();
    return catalog.filter(
      (p) =>
        p.nameAr.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q)),
    );
  }, [catalogData, checkoutSearch]);

  const handleOpenAddModal = () => {
    setAddProductsOpen(true);
    if (!selectedProduct && catalogData && catalogData.length > 0) {
      const first = catalogData[0];
      if (first) {
        setSelectedProduct(first);
        setSelectedVariantId(first.variants[0]?.id ?? "");
      }
    }
  };

  const handleSelectProduct = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setSelectedVariantId(product.variants[0]?.id ?? "");
    setAddProductQuantity(1);
    setAddProductMethod("CASH");
  };

  const handleAddProductToCheckout = async () => {
    if (!selectedProduct || !selectedVariantId) return;
    setIsAddingToCart(true);
    try {
      await addItem({
        data: {
          variantId: selectedVariantId,
          quantity: addProductQuantity,
          paymentMethod: addProductMethod,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success(
        locale === "ar"
          ? `تمت إضافة ${addProductQuantity} قطعة للطلب`
          : `Added ${addProductQuantity} items to order`,
      );
      setAddProductsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleQuantityChange = async (itemId: string, newQty: number) => {
    if (newQty < 1) {
      handleRemoveItem(itemId);
      return;
    }
    try {
      await updateItem({ data: { itemId, quantity: newQty } });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating item");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await deleteItem({ data: { itemId } });
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.info(locale === "ar" ? "تم حذف الصنف من الطلب" : "Item removed from order");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error removing item");
    }
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!customerPhone.match(/^01\d{9}$/)) {
      toast.error(
        locale === "ar"
          ? "يرجى إدخال رقم هاتف مصري صحيح (11 رقم يبدأ بـ 01)"
          : "Please enter a valid 11-digit Egyptian phone number starting with 01",
      );
      return;
    }
    if (!address.trim()) {
      toast.error(
        locale === "ar" ? "يرجى كتابة عنوان التوصيل بالتفصيل" : "Please enter the delivery address",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const shippingAddress = {
        address: address.trim(),
        street: address.trim(),
        secondaryPhone: secondaryPhone.trim(),
        notes: notes.trim(),
      };
      const fingerprint = checkoutFingerprint({
        shippingPaymentMethod: shippingMethod,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
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
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          shippingAddress,
          shippingPaymentMethod: shippingMethod,
          fingerprint,
        },
      });

      await router.navigate({ to: "/orders/$orderId", params: { orderId: result.orderId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "INTERNAL_ERROR");
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeVariant = selectedProduct?.variants.find((v) => v.id === selectedVariantId);
  const activeVariantPoints = activeVariant?.pointsPrice ?? selectedProduct?.defaultPointsPrice;
  const canPayActiveWithPoints =
    (selectedProduct?.pointsEnabled ?? false) && activeVariantPoints !== null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {locale === "ar" ? "إتمام وتأكيد الطلب" : "Order Checkout"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "أدخل بيانات المستلم واختر طريقة دفع الشحن بالكاش أو بالنقاط."
                : "Enter recipient delivery details and select Cash or Points payment."}
            </p>
          </div>

          {/* Search #2 (Checkout Add Products Button) */}
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-accent text-accent hover:bg-accent hover:text-white"
            onClick={handleOpenAddModal}
          >
            <PlusCircle className="size-4" />
            {locale === "ar" ? "إضافة منتجات للطلب" : "Add Products to Order"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Delivery Form */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {locale === "ar" ? "بيانات التوصيل والمستلم" : "Delivery & Recipient Details"}
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === "ar"
                  ? "يرجى التأكد من كتابة أرقام الهاتف والعنوان بدقة لضمان سرعة وصول المندوب."
                  : "Please provide accurate phone numbers and street address for prompt delivery."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                {/* 1. Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="cust-name">
                    {locale === "ar" ? "الاسم بالكامل *" : "Full Name *"}
                  </Label>
                  <Input
                    id="cust-name"
                    required
                    placeholder={locale === "ar" ? "مثال: سارة محمد أحمد" : "e.g. Sarah Mohamed"}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                {/* 2. Primary Phone */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-phone">
                      {locale === "ar" ? "رقم الهاتف الأساسي *" : "Primary Mobile Phone *"}
                    </Label>
                    <Input
                      id="cust-phone"
                      required
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="01XXXXXXXXX"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  {/* 3. Secondary Phone (Optional) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-phone-2">
                      {locale === "ar" ? "رقم هاتف ثانٍ (اختياري)" : "Secondary Phone (Optional)"}
                    </Label>
                    <Input
                      id="cust-phone-2"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="01XXXXXXXXX"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* 4. Address (العنوان) */}
                <div className="space-y-1.5">
                  <Label htmlFor="cust-addr">
                    {locale === "ar" ? "العنوان بالتفصيل *" : "Delivery Address *"}
                  </Label>
                  <Input
                    id="cust-addr"
                    required
                    placeholder={
                      locale === "ar"
                        ? "المحافظة، المنطقة، اسم الشارع، رقم العمارة، رقم الشقة أو علامة مميزة"
                        : "Street name, building number, apartment/floor, landmark"
                    }
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* 5. Notes (ملاحظات) */}
                <div className="space-y-1.5">
                  <Label htmlFor="cust-notes">
                    {locale === "ar"
                      ? "ملاحظات إضافية للتوصيل (اختياري)"
                      : "Delivery Notes (Optional)"}
                  </Label>
                  <Input
                    id="cust-notes"
                    placeholder={
                      locale === "ar"
                        ? "مثال: الاتصال قبل الوصول بنصف ساعة، أو الاستلام بعد الساعة 3 مساءً"
                        : "e.g. Call before arrival, leave with security"
                    }
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <Separator className="my-4" />

                {/* Shipping Payment Method */}
                <div className="space-y-2.5">
                  <Label className="font-bold">
                    {locale === "ar" ? "طريقة دفع مصاريف الشحن" : "Shipping Payment Method"}
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShippingMethod("CASH")}
                      className={`flex flex-col items-start rounded-xl border p-3 text-start transition-all ${
                        shippingMethod === "CASH"
                          ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <span className="font-semibold text-sm">
                        {locale === "ar" ? "دفع كاش عند الاستلام" : "Cash on Delivery"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatEGP(cashShippingCost)}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!hasEnoughPointsForShipping}
                      onClick={() => setShippingMethod("POINTS")}
                      className={`flex flex-col items-start rounded-xl border p-3 text-start transition-all ${
                        shippingMethod === "POINTS"
                          ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                          : "border-border hover:bg-muted/40 disabled:opacity-50"
                      }`}
                    >
                      <span className="flex items-center gap-1 font-semibold text-sm">
                        <Coins className="size-3.5 text-accent" />
                        {locale === "ar" ? "دفع بنقاط المحفظة" : "Pay with Points"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatPoints(pointsShippingCost)}
                      </span>
                    </button>
                  </div>

                  {shippingMethod === "POINTS" ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {locale === "ar"
                        ? `✓ الشحن مجاني كاش وسيتم خصم ${formatPoints(pointsShippingCost)} فقط من محفظتك.`
                        : `✓ Cash-free shipping; ${formatPoints(pointsShippingCost)} will be deducted from your points.`}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {locale === "ar"
                        ? `تكلفة الشحن كاش تُدفع للمندوب: ${formatEGP(cashShippingCost)}.`
                        : `Cash shipping fee payable upon delivery: ${formatEGP(cashShippingCost)}.`}
                    </p>
                  )}
                  {!hasEnoughPointsForShipping && shippingMethod !== "POINTS" ? (
                    <p className="text-[11px] text-muted-foreground">
                      {locale === "ar"
                        ? `(رصيدك الحالي: ${formatPoints(balance)} — الشحن بالنقاط يتطلب ${formatPoints(pointsShippingCost)})`
                        : `(Your balance: ${formatPoints(balance)} — Points shipping requires ${formatPoints(pointsShippingCost)})`}
                    </p>
                  ) : null}
                </div>

                {hasInsufficientPoints ? (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>
                      {locale === "ar"
                        ? `رصيد نقاطك (${formatPoints(balance)}) لا يكفي لتغطية إجمالي النقاط المطلوب (${formatPoints(preview.pointsTotal)}).`
                        : `Your points balance (${formatPoints(balance)}) is insufficient for the requested points (${formatPoints(preview.pointsTotal)}).`}
                    </span>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-bold shadow"
                  disabled={isSubmitting || isBlocked || isCartPending}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ShoppingBag className="size-5" />
                  )}
                  {locale === "ar" ? "تأكيد الطلب الآن" : "Place Order Now"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Order Summary Card */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {locale === "ar" ? "ملخص الطلب والأصناف" : "Order Summary & Items"}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {items.length} {locale === "ar" ? "أصناف" : "items"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items List */}
              {items.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>{locale === "ar" ? "السلة فارغة حاليًا" : "Your cart is empty"}</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-1"
                    onClick={handleOpenAddModal}
                  >
                    {locale === "ar" ? "إضافة منتجات للطلب الآن" : "Add products now"}
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-sm leading-snug">
                          {locale === "ar" ? item.productNameAr : item.productNameEn}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {locale === "ar" ? item.variantNameAr : item.variantNameEn} • SKU:{" "}
                          {item.sku}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex items-center rounded border border-border">
                            <button
                              type="button"
                              className="px-2 py-0.5 hover:bg-muted text-xs font-bold"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <span className="px-2 text-xs font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              className="px-2 py-0.5 hover:bg-muted text-xs font-bold"
                              disabled={item.quantity >= item.stock}
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive text-xs"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-end">
                        <div className="font-bold text-sm">
                          {item.paymentMethod === "POINTS" ? (
                            <span className="flex items-center justify-end gap-1 text-accent">
                              <Coins className="size-3" />
                              {formatPoints(item.linePointsTotal)}
                            </span>
                          ) : (
                            formatEGP(item.lineCashTotal)
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {item.paymentMethod === "POINTS"
                            ? locale === "ar"
                              ? "دفع بالنقاط"
                              : "Points"
                            : locale === "ar"
                              ? "دفع كاش"
                              : "Cash"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Totals Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{locale === "ar" ? "مصاريف الشحن" : "Shipping"}</span>
                  <span className="font-medium text-foreground">
                    {shippingMethod === "POINTS"
                      ? formatPoints(preview.shippingPoints)
                      : formatEGP(preview.shippingCash)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between text-base font-bold">
                  <span>{locale === "ar" ? "إجمالي الكاش المطلوب" : "Total Cash Due"}</span>
                  <span>{formatEGP(preview.cashTotal)}</span>
                </div>

                {preview.pointsTotal > 0 ? (
                  <div className="flex justify-between text-base font-bold text-accent">
                    <span>
                      {locale === "ar" ? "إجمالي النقاط المخصومة" : "Total Points Deducted"}
                    </span>
                    <span>{formatPoints(preview.pointsTotal)}</span>
                  </div>
                ) : null}
              </div>

              {/* Delivery notice */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <Truck className="size-4 shrink-0" />
                <span>
                  {locale === "ar" ? "مدة التسليم المتوقعة: " : "Estimated delivery: "}
                  {settings?.expectedDeliveryDuration ?? "2-4 business days"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Search #2 Modal: Add Products to Checkout */}
      <Dialog open={addProductsOpen} onOpenChange={setAddProductsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {locale === "ar" ? "إضافة منتج إلى طلبك مباشرة" : "Add Products to Order"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {locale === "ar"
                ? "ابحث في الكتالوج، اختر الخيار والكمية، وأضفه للطلب دون مغادرة صفحة الدفع."
                : "Search catalog, choose variant & quantity, and add directly to your active order."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Search Bar in Checkout */}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  locale === "ar"
                    ? "ابحث بالاسم العربي، الإنجليزي، أو كود الصنف SKU..."
                    : "Search products by name or SKU..."
                }
                value={checkoutSearch}
                onChange={(e) => setCheckoutSearch(e.target.value)}
                className="ps-9 pe-9"
              />
              {checkoutSearch ? (
                <button
                  type="button"
                  onClick={() => setCheckoutSearch("")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {/* Product selection list */}
            <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {searchResults.map((prod) => {
                const isSel = selectedProduct?.id === prod.id;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className={`flex items-center gap-3 rounded-lg border p-2 text-start transition-colors ${
                      isSel
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {prod.imageUrl ? (
                        <img src={prod.imageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <Package className="size-full p-2 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-xs">
                        {locale === "ar" ? prod.nameAr : prod.nameEn}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatEGP(prod.cashPrice)}
                        {prod.pointsEnabled && prod.defaultPointsPrice
                          ? ` • ${formatPoints(prod.defaultPointsPrice)}`
                          : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Chosen Product Options Configurator */}
            {selectedProduct ? (
              <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">
                    {locale === "ar" ? selectedProduct.nameAr : selectedProduct.nameEn}
                  </h4>
                  {activeVariant ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      SKU: {activeVariant.sku}
                    </span>
                  ) : null}
                </div>

                {/* Variants (Real persisted combinations) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {locale === "ar" ? "الخيار المطلوب (اللون / المقاس)" : "Select Variant"}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.variants.map((v) => (
                      <Button
                        key={v.id}
                        type="button"
                        size="sm"
                        variant={v.id === selectedVariantId ? "default" : "outline"}
                        disabled={v.stock < 1}
                        onClick={() => setSelectedVariantId(v.id)}
                        className="h-8 text-xs"
                      >
                        {locale === "ar" ? v.nameAr : v.nameEn} ({formatEGP(v.cashPrice)})
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Payment Method for this item */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {locale === "ar" ? "طريقة الدفع لهذا المنتج" : "Payment Method"}
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={addProductMethod === "CASH" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => setAddProductMethod("CASH")}
                    >
                      {locale === "ar"
                        ? `كاش (${formatEGP(activeVariant?.cashPrice ?? selectedProduct.cashPrice)})`
                        : `Cash (${formatEGP(activeVariant?.cashPrice ?? selectedProduct.cashPrice)})`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={addProductMethod === "POINTS" ? "default" : "outline"}
                      disabled={!canPayActiveWithPoints}
                      className="h-8 text-xs"
                      onClick={() => setAddProductMethod("POINTS")}
                    >
                      {locale === "ar"
                        ? `نقاط (${canPayActiveWithPoints ? formatPoints(activeVariantPoints!) : "غير متاح"})`
                        : `Points (${canPayActiveWithPoints ? formatPoints(activeVariantPoints!) : "N/A"})`}
                    </Button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {locale === "ar" ? "الكمية:" : "Quantity:"}
                    </Label>
                    <div className="flex items-center rounded border border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={addProductQuantity <= 1}
                        onClick={() => setAddProductQuantity((q) => Math.max(1, q - 1))}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center text-xs font-bold">
                        {addProductQuantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={!activeVariant || addProductQuantity >= activeVariant.stock}
                        onClick={() => setAddProductQuantity((q) => q + 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? `المتاح: ${activeVariant?.stock ?? 0}`
                      : `In stock: ${activeVariant?.stock ?? 0}`}
                  </span>
                </div>

                <Button
                  type="button"
                  className="w-full gap-2 font-bold"
                  disabled={isAddingToCart || !activeVariant || activeVariant.stock < 1}
                  onClick={handleAddProductToCheckout}
                >
                  {isAddingToCart ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="size-4" />
                  )}
                  {locale === "ar" ? "إضافة إلى الطلب الحالي" : "Add to Current Order"}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
