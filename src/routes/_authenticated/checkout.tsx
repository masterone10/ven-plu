import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  Coins,
  CreditCard,
  Layers,
  Loader2,
  Minus,
  Package,
  PackagePlus,
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
  addMultipleCartItems,
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
import {
  extractVariantAttributes,
  findExactVariant,
  getAttributesForVariant,
  isAttributeAvailable,
  resolveVariant,
} from "@/lib/variant-resolution";
import { extractMatrixFromVariants } from "@/lib/variant-matrix";
import { primaryForVariant } from "@/lib/variant-media";
import { CheckoutProductMatrix } from "@/components/checkout-product-matrix";
import { InCheckoutProductPicker } from "@/components/in-checkout-product-picker";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "VEN+ Order Builder & Checkout" },
      {
        name: "description",
        content:
          "Build and customize your order directly, choose variants, adjust quantities and payment methods, and confirm delivery.",
      },
      { property: "og:title", content: "VEN+ Order Builder" },
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
  const addMultipleCart = useServerFn(addMultipleCartItems);
  const updateCart = useServerFn(updateCartItem);
  const removeCart = useServerFn(removeCartItem);

  const { locale, formatEGP, formatPoints } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

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

  // Group items by productId for Matrix representation
  const groupedProductCards = useMemo(() => {
    const map = new Map<string, CartItemView[]>();
    for (const item of items) {
      const list = map.get(item.productId) ?? [];
      list.push(item);
      map.set(item.productId, list);
    }

    const groups: Array<{
      productId: string;
      catalogProduct?: CatalogProduct | undefined;
      items: CartItemView[];
      isMatrix: boolean;
    }> = [];

    for (const [productId, prodItems] of map.entries()) {
      const catalogProduct = catalogData?.find((p) => p.id === productId);
      const matrixInfo = catalogProduct
        ? extractMatrixFromVariants(catalogProduct.variants, catalogProduct.slug)
        : null;
      const isMatrix = Boolean(
        matrixInfo && matrixInfo.colors.length > 0 && matrixInfo.sizes.length > 0,
      );

      groups.push({
        productId,
        catalogProduct: catalogProduct ?? undefined,
        items: prodItems,
        isMatrix,
      });
    }

    return groups;
  }, [items, catalogData]);

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
    mutationFn: (input: {
      itemId: string;
      variantId?: string;
      quantity?: number;
      paymentMethod?: PaymentMethod;
    }) => updateCart({ data: input }),
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

  const handleFocusAddProduct = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
    <div className="min-h-screen bg-background pb-12">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Top Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              {locale === "ar" ? "أوردرات — بناء الطلب" : "Order Builder & Checkout"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "أضف منتجاتك، عدّل الخيارات والكميات، وأدخل بيانات التوصيل لتأكيد الطلب."
                : "Add products, customize variants and quantities, and place your order directly."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5 font-bold"
              onClick={() => setIsAddProductModalOpen(true)}
            >
              <PackagePlus className="size-4" />
              {locale === "ar" ? "+ إضافة منتج جديد" : "+ Add new product"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Left Column: Order Items Builder & Add Product Search */}
          <div className="space-y-6">
            {/* Order Items Builder Card */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Package className="size-5 text-accent" />
                    {locale === "ar" ? "محتويات الأوردر" : "Order Products"}
                  </CardTitle>
                  <CardDescription>
                    {locale === "ar"
                      ? "يمكنك تعديل المتغيّرات، الكمية، أو طريقة الدفع مباشرة لكل منتج."
                      : "Directly customize variants, quantities, or payment method for each product."}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-bold">
                  {items.length} {locale === "ar" ? "متغيّر" : "items"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCartPending ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin me-2" />
                    {locale === "ar" ? "جاري تحميل محتويات الأوردر..." : "Loading order items..."}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground space-y-3">
                    <Package className="mx-auto size-10 stroke-1 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">
                      {locale === "ar"
                        ? "الأوردر الحالي فارغ — أضف أول منتج للبدء!"
                        : "Your order draft is empty — add your first product to begin!"}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setIsAddProductModalOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      {locale === "ar" ? "+ إضافة منتج جديد" : "+ Add new product"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedProductCards.map((group) => {
                      if (group.isMatrix) {
                        return (
                          <CheckoutProductMatrix
                            key={group.productId}
                            productId={group.productId}
                            catalogProduct={group.catalogProduct}
                            items={group.items}
                            busy={updateMutation.isPending || removeMutation.isPending}
                            onUpdateQuantity={(itemId, quantity) =>
                              updateMutation.mutate({ itemId, quantity })
                            }
                            onRemoveItem={(itemId) => removeMutation.mutate(itemId)}
                            onAddVariant={async (variantId, quantity, paymentMethod) => {
                              await addCart({ data: { variantId, quantity, paymentMethod } });
                              invalidateCart();
                            }}
                            onUpdatePaymentMethod={(itemId, method) =>
                              updateMutation.mutate({ itemId, paymentMethod: method })
                            }
                          />
                        );
                      }

                      return group.items.map((item) => (
                        <CheckoutProductCard
                          key={item.id}
                          item={item}
                          catalogProduct={group.catalogProduct}
                          busy={updateMutation.isPending || removeMutation.isPending}
                          onVariant={(variantId, quantity) =>
                            updateMutation.mutate(
                              quantity !== undefined
                                ? { itemId: item.id, variantId, quantity }
                                : { itemId: item.id, variantId },
                            )
                          }
                          onQuantity={(quantity) =>
                            updateMutation.mutate({ itemId: item.id, quantity })
                          }
                          onMethod={(paymentMethod) =>
                            updateMutation.mutate({ itemId: item.id, paymentMethod })
                          }
                          onRemove={() => removeMutation.mutate(item.id)}
                        />
                      ));
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* In-Checkout Product Search & Quick Add Section */}
            <Card className="border-border shadow-xs bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Search className="size-4 text-accent" />
                    {locale === "ar" ? "إضافة منتج جديد للأوردر" : "Add New Product to Order"}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs font-semibold gap-1"
                    onClick={() => setIsAddProductModalOpen(true)}
                  >
                    <Plus className="size-3" />
                    {locale === "ar" ? "إضافة منتج" : "Add product"}
                  </Button>
                </div>
                <CardDescription>
                  {locale === "ar"
                    ? "ابحث باسم المنتج أو كود SKU لإضافته إلى نفس الأوردر فوراً دون مغادرة الشاشة."
                    : "Search by product name or SKU to add items directly to your order without leaving."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder={
                      locale === "ar"
                        ? "ابحث باسم المنتج أو كود SKU..."
                        : "Search product name or SKU..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9 bg-background"
                  />
                </div>

                {searchQuery.trim().length > 0 ? (
                  <div className="space-y-3 rounded-xl border bg-background/80 p-3">
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
                              locale === "ar"
                                ? "تمت إضافة المنتج للأوردر"
                                : "Added product to order",
                            );
                          }}
                        />
                      ))
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Delivery Details Card */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <User className="size-5 text-accent" />
                  {locale === "ar" ? "بيانات التوصيل والتسليم" : "Delivery Information"}
                </CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "الرجاء كتابة الاسم ورقم الهاتف والعنوان بدقة لتسليم الطلب."
                    : "Please provide complete recipient details and street address."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form id="checkout-form" className="space-y-4" onSubmit={onSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="checkout-name" className="text-xs font-semibold">
                        {locale === "ar" ? "الاسم بالكامل *" : "Full name *"}
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
                        className={`flex flex-col items-start justify-between rounded-xl border p-3 text-start transition-all ${
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
                        className={`flex flex-col items-start justify-between rounded-xl border p-3 text-start transition-all ${
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
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary & Review */}
          <div className="space-y-6">
            <Card className="sticky top-20 border-border shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg font-bold">
                  <span className="flex items-center gap-2">
                    <Layers className="size-5 text-accent" />
                    {locale === "ar" ? "ملخص الأوردر" : "Order Summary"}
                  </span>
                  <Badge variant="outline" className="font-semibold">
                    {locale === "ar" ? "مسودة أوردر" : "Draft Order"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items Summary Quick List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                    >
                      <div className="min-w-0 flex-1 pe-2">
                        <p className="font-semibold truncate text-foreground">
                          {locale === "ar" ? item.productNameAr : item.productNameEn}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {locale === "ar" ? item.variantNameAr : item.variantNameEn}
                          {" × "}
                          {item.quantity} ({item.paymentMethod})
                        </p>
                      </div>
                      <span className="font-bold shrink-0">
                        {item.paymentMethod === "POINTS"
                          ? formatPoints(item.linePointsTotal)
                          : formatEGP(item.lineCashTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Financial Summary */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "إجمالي المنتجات (كاش)" : "Products Cash Subtotal"}
                    </span>
                    <span className="font-semibold">{formatEGP(preview.cashItems)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "إجمالي المنتجات (نقاط)" : "Products Points Subtotal"}
                    </span>
                    <span className="font-semibold">{formatPoints(preview.pointsItems)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {locale === "ar" ? "مصاريف الشحن والتوصيل" : "Shipping Fee"}
                    </span>
                    <span className="font-semibold">
                      {shippingMethod === "POINTS"
                        ? formatPoints(preview.shippingPoints)
                        : formatEGP(preview.shippingCash)}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-base font-bold text-foreground pt-1">
                    <span>{locale === "ar" ? "الإجمالي كاش المطلوب" : "Total Cash Due"}</span>
                    <span className="text-primary text-lg">{formatEGP(preview.cashTotal)}</span>
                  </div>

                  <div className="flex justify-between text-base font-bold text-foreground">
                    <span>{locale === "ar" ? "الإجمالي بالنقاط المطلوب" : "Total Points Due"}</span>
                    <span className="text-accent text-lg">{formatPoints(preview.pointsTotal)}</span>
                  </div>

                  <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {locale === "ar" ? "رصيدك الحالي من النقاط:" : "Current points balance:"}
                      </span>
                      <span className="font-semibold text-foreground">{formatPoints(balance)}</span>
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
                              : "font-semibold text-foreground"
                          }
                        >
                          {formatPoints(Math.max(0, preview.pointsRemaining))}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {hasInsufficientPoints ? (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
                      {locale === "ar"
                        ? `رصيد نقاطك (${formatPoints(balance)}) غير كافٍ لتغطية إجمالي النقاط المطلوب (${formatPoints(preview.pointsTotal)}).`
                        : `Your points balance (${formatPoints(balance)}) is insufficient for the required total (${formatPoints(preview.pointsTotal)}).`}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    form="checkout-form"
                    className="mt-4 w-full h-12 text-base font-bold shadow-md rounded-xl"
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

        {/* Modal / Dialog for In-Checkout Product Search with Color × Size Matrix support */}
        <InCheckoutProductPicker
          open={isAddProductModalOpen}
          onOpenChange={setIsAddProductModalOpen}
          catalog={catalogData ?? []}
          onAddMultiple={async (newItems) => {
            await addMultipleCart({ data: { items: newItems } });
            invalidateCart();
            toast.success(
              locale === "ar"
                ? `تمت إضافة ${newItems.reduce((a, b) => a + b.quantity, 0)} قطعة للأوردر`
                : `Added ${newItems.reduce((a, b) => a + b.quantity, 0)} items to order`,
            );
          }}
        />
      </main>
    </div>
  );
}

/**
 * Direct Editable Product Card inside Checkout.
 * Allows instant granular editing of Color/Size/Variant dimensions, Quantity, and Cash/Points mode.
 */
function CheckoutProductCard({
  item,
  catalogProduct,
  busy,
  onVariant,
  onQuantity,
  onMethod,
  onRemove,
}: {
  item: CartItemView;
  catalogProduct: CatalogProduct | undefined;
  busy: boolean;
  onVariant: (variantId: string, quantity?: number) => void;
  onQuantity: (qty: number) => void;
  onMethod: (method: PaymentMethod) => void;
  onRemove: () => void;
}) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const productName = locale === "ar" ? item.productNameAr : item.productNameEn;

  // Variants list: prefer catalogProduct variants, fallback to single variant from item
  const variants = useMemo<CatalogVariant[]>(() => {
    if (catalogProduct?.variants && catalogProduct.variants.length > 0) {
      return catalogProduct.variants;
    }
    return [
      {
        id: item.variantId,
        sku: item.sku,
        nameEn: item.variantNameEn,
        nameAr: item.variantNameAr,
        cashPrice: item.unitCashPrice,
        pointsPrice: item.unitPointsPrice,
        stock: item.stock,
      },
    ];
  }, [catalogProduct, item]);

  // Extract dimensions and parsed variants
  const { dimensions, parsedVariants } = useMemo(
    () => extractVariantAttributes(variants, locale),
    [variants, locale],
  );

  // Maintain selectedAttributes state, initialized from current item.variantId
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(() =>
    getAttributesForVariant(parsedVariants, item.variantId),
  );

  // Sync selected attributes if item.variantId changes from external update
  const [prevVariantId, setPrevVariantId] = useState(item.variantId);
  if (prevVariantId !== item.variantId) {
    setPrevVariantId(item.variantId);
    setSelectedAttributes(getAttributesForVariant(parsedVariants, item.variantId));
  }

  // Exact resolution
  const matchedVariant = findExactVariant(parsedVariants, selectedAttributes);
  const isInvalidCombination = !matchedVariant && dimensions.length > 0;

  // Current values
  const currentVariant =
    matchedVariant ?? parsedVariants.find((pv) => pv.variant.id === item.variantId)?.variant;
  const resolvedSku = currentVariant?.sku ?? item.sku;
  const resolvedStock = currentVariant?.stock ?? item.stock;
  const resolvedCashPrice =
    currentVariant?.cashPrice ?? catalogProduct?.cashPrice ?? item.unitCashPrice;
  const resolvedPointsPrice =
    currentVariant?.pointsPrice ?? catalogProduct?.defaultPointsPrice ?? item.unitPointsPrice;

  // Dynamic variant image resolution via variant-media rules
  const resolvedImage = useMemo(() => {
    if (currentVariant && catalogProduct?.images && catalogProduct.images.length > 0) {
      const primary = primaryForVariant(catalogProduct.images, currentVariant.id);
      if (primary?.url) return primary.url;
    }
    return item.imageUrl ?? catalogProduct?.imageUrl ?? null;
  }, [catalogProduct, currentVariant, item.imageUrl]);

  const handleAttributeChange = (dimName: string, newValue: string) => {
    const nextAttrs = { ...selectedAttributes, [dimName]: newValue };
    setSelectedAttributes(nextAttrs);

    const nextVariant = findExactVariant(parsedVariants, nextAttrs);
    if (nextVariant) {
      if (nextVariant.id !== item.variantId) {
        const clampedQty = Math.min(item.quantity, Math.max(1, nextVariant.stock));
        onVariant(nextVariant.id, clampedQty);
      }
    }
  };

  const isOutOfStock = resolvedStock <= 0;

  return (
    <Card className="overflow-hidden border border-border/90 bg-card shadow-xs rounded-xl transition-all">
      <CardContent className="p-4 space-y-3.5">
        {/* Top Product Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {resolvedImage ? (
              <img
                src={resolvedImage}
                alt={productName}
                className="size-16 rounded-lg object-cover border shrink-0 bg-muted/20"
              />
            ) : (
              <div className="size-16 rounded-lg bg-muted flex items-center justify-center border shrink-0">
                <Package className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <h4 className="font-bold text-sm text-foreground truncate">{productName}</h4>
              <p className="font-mono text-[11px] text-muted-foreground">SKU: {resolvedSku}</p>
              <div className="flex items-center gap-2 pt-0.5">
                {isOutOfStock ? (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-bold">
                    {locale === "ar" ? "نفد من المخزون" : "Out of stock"}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {locale === "ar"
                      ? `المتاح: ${resolvedStock} قطعة`
                      : `In Stock: ${resolvedStock}`}
                  </span>
                )}
                <span className="text-muted-foreground text-[11px]">|</span>
                <span className="text-[11px] font-semibold text-foreground">
                  {formatEGP(resolvedCashPrice)}
                  {item.pointsEnabled && resolvedPointsPrice ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      / {formatPoints(resolvedPointsPrice)}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          {/* Remove / Delete Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-8 px-2.5 rounded-lg gap-1 shrink-0"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            <span>{locale === "ar" ? "حذف" : "Remove"}</span>
          </Button>
        </div>

        {/* Warning if combination is invalid */}
        {isInvalidCombination ? (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>
              {locale === "ar"
                ? "هذا الاختيار غير متاح حالياً. يرجى اختيار تركيبة أخرى."
                : "This option combination is not available. Please choose another selection."}
            </span>
          </div>
        ) : null}

        <Separator />

        {/* Granular Attribute Selectors */}
        {dimensions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {locale === "ar" ? "خصائص المنتج / الخيارات" : "Product Attributes & Options"}
            </p>
            <div
              className={`grid gap-2.5 ${
                dimensions.length === 1
                  ? "grid-cols-1"
                  : dimensions.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-3"
              }`}
            >
              {dimensions.map((dim) => (
                <div key={dim.name} className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>{dim.name}:</span>
                    <span className="font-normal text-muted-foreground text-[10px]">
                      {selectedAttributes[dim.name] || (locale === "ar" ? "غير محدد" : "None")}
                    </span>
                  </Label>
                  <select
                    value={selectedAttributes[dim.name] ?? ""}
                    onChange={(e) => handleAttributeChange(dim.name, e.target.value)}
                    disabled={busy}
                    className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    {dim.values.map((val) => {
                      const { available, inStock } = isAttributeAvailable(
                        parsedVariants,
                        dim.name,
                        val,
                        selectedAttributes,
                      );
                      return (
                        <option key={val} value={val} disabled={!available}>
                          {val}{" "}
                          {!available
                            ? locale === "ar"
                              ? "(غير متاح)"
                              : "(Unavailable)"
                            : !inStock
                              ? locale === "ar"
                                ? "(نفد)"
                                : "(Out of stock)"
                              : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Payment Method & Quantity Controls */}
        <div className="grid gap-3 sm:grid-cols-2 pt-1 bg-muted/20 p-2.5 rounded-lg border border-border/50">
          {/* Payment Method Selector */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground">
              {locale === "ar" ? "طريقة الدفع للمنتج:" : "Payment mode for item:"}
            </Label>
            <select
              value={item.paymentMethod}
              onChange={(e) => onMethod(e.target.value as PaymentMethod)}
              disabled={busy || !item.pointsEnabled || (resolvedPointsPrice ?? 0) <= 0}
              className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="CASH">{locale === "ar" ? "كاش (EGP)" : "Cash (EGP)"}</option>
              {item.pointsEnabled && (resolvedPointsPrice ?? 0) > 0 ? (
                <option value="POINTS">{locale === "ar" ? "نقاط (Points)" : "Points"}</option>
              ) : null}
            </select>
          </div>

          {/* Quantity Controls */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground">
              {locale === "ar" ? "الكمية المطلوبة:" : "Quantity:"}
            </Label>
            <div className="flex h-8 items-center rounded-lg border bg-background">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 h-8 w-8 rounded-none rounded-s-lg"
                disabled={busy || item.quantity <= 1}
                onClick={() => onQuantity(item.quantity - 1)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="flex-1 text-center text-xs font-bold">{item.quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 h-8 w-8 rounded-none rounded-e-lg"
                disabled={busy || isOutOfStock || item.quantity >= resolvedStock}
                onClick={() => onQuantity(item.quantity + 1)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Subtotal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
          <span className="text-muted-foreground font-medium">
            {locale === "ar" ? "إجمالي هذا العنصر:" : "Item Subtotal:"}
          </span>
          <span className="text-sm font-bold text-foreground">
            {item.paymentMethod === "POINTS"
              ? formatPoints(item.linePointsTotal)
              : formatEGP(item.lineCashTotal)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Quick Add Product Search Row inside Checkout.
 * Fully mirrors the attribute dimension selection, dynamic media, SKU, stock and price resolution.
 */
function InCheckoutProductPickerRow({
  product,
  onAdd,
}: {
  product: CatalogProduct;
  onAdd: (variantId: string, quantity: number, paymentMethod: PaymentMethod) => Promise<void>;
}) {
  const { locale, formatEGP, formatPoints } = useI18n();

  const { dimensions, parsedVariants } = useMemo(
    () => extractVariantAttributes(product.variants, locale),
    [product.variants, locale],
  );

  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(
    () => parsedVariants[0]?.attributes ?? {},
  );

  const matchedVariant =
    findExactVariant(parsedVariants, selectedAttributes) ?? parsedVariants[0]?.variant ?? null;

  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [loading, setLoading] = useState(false);

  // Dynamic image based on variant-media
  const resolvedImage = useMemo(() => {
    if (matchedVariant && product.images && product.images.length > 0) {
      const primary = primaryForVariant(product.images, matchedVariant.id);
      if (primary?.url) return primary.url;
    }
    return product.imageUrl ?? null;
  }, [matchedVariant, product.images, product.imageUrl]);

  const resolvedCashPrice = matchedVariant?.cashPrice ?? product.cashPrice;
  const resolvedPointsPrice = matchedVariant?.pointsPrice ?? product.defaultPointsPrice;
  const resolvedStock = matchedVariant?.stock ?? 0;
  const isOutOfStock = resolvedStock <= 0;

  const handleAttributeChange = (dimName: string, val: string) => {
    const next = { ...selectedAttributes, [dimName]: val };
    setSelectedAttributes(next);
    const nextVar = findExactVariant(parsedVariants, next);
    if (nextVar) {
      setQty((q) => Math.min(q, Math.max(1, nextVar.stock)));
    }
  };

  return (
    <div className="rounded-xl border bg-card p-3.5 text-xs shadow-2xs space-y-3">
      {/* Product Summary Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {resolvedImage ? (
            <img
              src={resolvedImage}
              alt={locale === "ar" ? product.nameAr : product.nameEn}
              className="size-12 rounded-lg object-cover border shrink-0 bg-muted/20"
            />
          ) : (
            <div className="size-12 rounded-lg bg-muted flex items-center justify-center border shrink-0">
              <Package className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold truncate text-foreground">
              {locale === "ar" ? product.nameAr : product.nameEn}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono">SKU: {matchedVariant?.sku ?? "-"}</span>
              <span>|</span>
              <span
                className={
                  isOutOfStock ? "text-destructive font-semibold" : "text-emerald-600 font-medium"
                }
              >
                {isOutOfStock
                  ? locale === "ar"
                    ? "نفد"
                    : "Out of stock"
                  : locale === "ar"
                    ? `المتاح: ${resolvedStock}`
                    : `Stock: ${resolvedStock}`}
              </span>
            </div>
          </div>
        </div>

        {/* Price Tag */}
        <div className="text-end shrink-0">
          <p className="font-bold text-foreground">
            {method === "POINTS" && product.pointsEnabled && resolvedPointsPrice
              ? formatPoints(resolvedPointsPrice)
              : formatEGP(resolvedCashPrice)}
          </p>
        </div>
      </div>

      {/* Attribute Dropdowns / Dimensions */}
      {dimensions.length > 0 ? (
        <div
          className={`grid gap-2 pt-1 border-t border-border/40 ${
            dimensions.length === 1
              ? "grid-cols-1"
              : dimensions.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
          }`}
        >
          {dimensions.map((dim) => (
            <div key={dim.name} className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground block truncate">
                {dim.name}:
              </span>
              <select
                className="w-full h-7 rounded-lg border bg-background px-2 text-[11px] font-medium"
                value={selectedAttributes[dim.name] ?? ""}
                onChange={(e) => handleAttributeChange(dim.name, e.target.value)}
              >
                {dim.values.map((v) => {
                  const { available, inStock } = isAttributeAvailable(
                    parsedVariants,
                    dim.name,
                    v,
                    selectedAttributes,
                  );
                  return (
                    <option key={v} value={v} disabled={!available}>
                      {v}{" "}
                      {!available
                        ? locale === "ar"
                          ? "(غير متاح)"
                          : "(Unavailable)"
                        : !inStock
                          ? locale === "ar"
                            ? "(نفد)"
                            : "(Out of stock)"
                          : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      ) : null}

      {/* Action and Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
        {/* Payment mode toggle */}
        {product.pointsEnabled && (resolvedPointsPrice ?? 0) > 0 ? (
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
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
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                method === "POINTS"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMethod("POINTS")}
            >
              {locale === "ar" ? "نقاط" : "Points"}
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground font-medium">
            {locale === "ar" ? "دفع كاش فقط" : "Cash payment only"}
          </span>
        )}

        <div className="flex items-center gap-2 ms-auto">
          {/* Quantity Controls */}
          <div className="flex h-7 items-center rounded-lg border bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 h-7 w-7 rounded-none rounded-s-lg"
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-5 text-center text-xs font-bold">{qty}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 h-7 w-7 rounded-none rounded-e-lg"
              disabled={isOutOfStock || qty >= resolvedStock}
              onClick={() => setQty((q) => q + 1)}
            >
              <Plus className="size-3" />
            </Button>
          </div>

          {/* Add to Order Button */}
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-xs font-bold rounded-lg gap-1"
            disabled={loading || !matchedVariant || isOutOfStock}
            onClick={async () => {
              if (!matchedVariant) return;
              setLoading(true);
              try {
                await onAdd(matchedVariant.id, qty, method);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            {locale === "ar" ? "إضافة للأوردر" : "Add to order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
