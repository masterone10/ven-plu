import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import type { AdminProductRow } from "@/lib/admin-product-rules";
import { adminPlaceOrder } from "@/lib/admin-order-functions";

type OrderLineItem = {
  tempId: string;
  productId: string;
  variantId: string;
  quantity: number;
  productPaymentMethod: "CASH" | "POINTS";
};

type PlacedResult = {
  orderId: string;
  orderNumber: string;
  created: boolean;
  customerName: string;
  customerPhone: string;
  cashDue: number;
  pointsDue: number;
  fundingMode: string;
};

export function AdminOrderEntry({ products }: { products: AdminProductRow[] }) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();
  const placeOrderFn = useServerFn(adminPlaceOrder);

  // Customer contact & address state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSecondaryPhone, setCustomerSecondaryPhone] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  // Product line items state
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [shippingPaymentMethod, setShippingPaymentMethod] = useState<"CASH" | "POINTS">("CASH");

  // Confirmation modal state
  const [confirmation, setConfirmation] = useState<PlacedResult | null>(null);

  // Filter products for quick search
  const searchableProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (!term) return true;
      const titleEn = (p.nameEn || p.titleEn || "").toLowerCase();
      const titleAr = (p.nameAr || p.titleAr || "").toLowerCase();
      const slug = (p.slug || "").toLowerCase();
      return titleEn.includes(term) || titleAr.includes(term) || slug.includes(term);
    });
  }, [products, productSearch]);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  // Handle adding product line
  const handleAddProduct = () => {
    const product = activeProducts.find((p) => p.id === selectedProductId) || activeProducts[0];
    if (!product || !product.variants || product.variants.length === 0) {
      toast.error(locale === "ar" ? "يرجى اختيار منتج صالح" : "Please select a valid product");
      return;
    }

    const defaultVariant =
      product.variants.find((v) => v.isActive && v.stock > 0) || product.variants[0];
    if (!defaultVariant) return;

    const newItem: OrderLineItem = {
      tempId: crypto.randomUUID(),
      productId: product.id,
      variantId: defaultVariant.id,
      quantity: 1,
      productPaymentMethod: "CASH",
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductId("");
    setProductSearch("");
  };

  const handleUpdateItem = (tempId: string, updates: Partial<OrderLineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;
        const updated = { ...item, ...updates };

        // If product changed, update default variant
        if (updates.productId && updates.productId !== item.productId) {
          const product = products.find((p) => p.id === updates.productId);
          if (product && product.variants && product.variants.length > 0) {
            const defVar =
              product.variants.find((v) => v.isActive && v.stock > 0) || product.variants[0];
            if (defVar) {
              updated.variantId = defVar.id;
            }
            if (!product.pointsEnabled) {
              updated.productPaymentMethod = "CASH";
            }
          }
        }
        return updated;
      }),
    );
  };

  const handleRemoveItem = (tempId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  // Calculate live preview totals
  const totals = useMemo(() => {
    let subtotalCash = 0;
    let totalCashDue = 0;
    let totalPointsDue = 0;
    let usesCash = false;
    let usesPoints = false;

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      const unitCash = variant?.cashPrice ?? product?.cashPrice ?? 0;
      const unitPoints = variant?.pointsPrice ?? product?.defaultPointsPrice ?? 0;

      subtotalCash += unitCash * item.quantity;

      if (item.productPaymentMethod === "POINTS") {
        totalPointsDue += unitPoints * item.quantity;
        usesPoints = true;
      } else {
        totalCashDue += unitCash * item.quantity;
        usesCash = true;
      }
    }

    const shippingCash = 50; // default store shipping
    const shippingPoints = 200;

    if (shippingPaymentMethod === "POINTS") {
      totalPointsDue += shippingPoints;
      usesPoints = true;
    } else {
      totalCashDue += shippingCash;
      usesCash = true;
    }

    let fundingMode: "CASH_ONLY" | "POINTS_ONLY" | "MIXED" = "CASH_ONLY";
    if (usesCash && usesPoints) fundingMode = "MIXED";
    else if (usesPoints) fundingMode = "POINTS_ONLY";

    return {
      subtotalCash,
      shippingCash,
      shippingPoints,
      totalCashDue,
      totalPointsDue,
      fundingMode,
    };
  }, [items, products, shippingPaymentMethod]);

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      // Validate customer phone
      const phoneClean = customerPhone.trim();
      if (!/^01\d{9}$/.test(phoneClean)) {
        throw new Error(
          locale === "ar"
            ? "رقم الهاتف يجب أن يتكون من 11 رقماً ويبدأ بـ 01"
            : "Customer phone must be 11 digits starting with 01",
        );
      }

      if (!customerName.trim()) {
        throw new Error(locale === "ar" ? "اسم العميل مطلوب" : "Customer full name is required");
      }

      if (!governorate.trim() || !city.trim() || !street.trim()) {
        throw new Error(
          locale === "ar" ? "بيانات العنوان كاملة مطلوبة" : "Complete address details are required",
        );
      }

      if (items.length === 0) {
        throw new Error(
          locale === "ar" ? "يرجى إضافة منتج واحد على الأقل للطلب" : "Please add at least one item",
        );
      }

      const idempotencyKey = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await placeOrderFn({
        data: {
          idempotencyKey,
          customerName: customerName.trim(),
          customerPhone: phoneClean,
          customerSecondaryPhone: customerSecondaryPhone.trim(),
          customerWhatsApp: customerWhatsApp.trim(),
          shippingAddress: {
            governorate: governorate.trim(),
            city: city.trim(),
            street: street.trim(),
            notes: addressNotes.trim(),
          },
          customerNotes: customerNotes.trim(),
          items: items.map((it) => ({
            variantId: it.variantId,
            quantity: it.quantity,
            productPaymentMethod: it.productPaymentMethod,
          })),
          shippingPaymentMethod,
          fingerprint: `admin-console-${navigator.userAgent}`,
        },
      });

      return {
        ...res,
        customerName: customerName.trim(),
        customerPhone: phoneClean,
        cashDue: totals.totalCashDue,
        pointsDue: totals.totalPointsDue,
        fundingMode: totals.fundingMode,
      };
    },
    onSuccess: (result) => {
      setConfirmation(result);
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(
        locale === "ar"
          ? `تم إنشاء الطلب بنجاح رقم #${result.orderNumber}`
          : `Order #${result.orderNumber} created successfully!`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to place admin order");
    },
  });

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerSecondaryPhone("");
    setCustomerWhatsApp("");
    setGovernorate("");
    setCity("");
    setStreet("");
    setAddressNotes("");
    setCustomerNotes("");
    setItems([]);
    setConfirmation(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {locale === "ar" ? "إنشاء طلب جديد بالنيابة عن العميل" : "Admin Order Entry Workspace"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? "إدخال طلب مباشر مع التحقق الصارم من صحة الأسعار، المخزون، ورصيد النقاط على الخادم."
              : "Direct order entry with server-authoritative stock, pricing, and idempotency guarantees."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Customer & Destination Information */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" />
              {locale === "ar" ? "بيانات العميل والشحن" : "Customer & Destination"}
            </CardTitle>
            <CardDescription>
              {locale === "ar"
                ? "أدخل بيانات التواصل وعنوان التوصيل"
                : "Customer contact info and delivery address"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="admin-cust-name" className="text-xs font-semibold">
                {locale === "ar" ? "اسم العميل الكامل *" : "Full Name *"}
              </Label>
              <Input
                id="admin-cust-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={locale === "ar" ? "محمد أحمد" : "John Doe"}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="admin-cust-phone" className="text-xs font-semibold">
                  {locale === "ar" ? "الهاتف الأساسي *" : "Primary Phone *"}
                </Label>
                <Input
                  id="admin-cust-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01012345678"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="admin-cust-sec-phone" className="text-xs font-semibold">
                  {locale === "ar" ? "هاتف إضافي" : "Secondary Phone"}
                </Label>
                <Input
                  id="admin-cust-sec-phone"
                  value={customerSecondaryPhone}
                  onChange={(e) => setCustomerSecondaryPhone(e.target.value)}
                  placeholder="01112345678"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-cust-wa" className="text-xs font-semibold">
                {locale === "ar" ? "رقم الواتساب" : "WhatsApp Number"}
              </Label>
              <Input
                id="admin-cust-wa"
                value={customerWhatsApp}
                onChange={(e) => setCustomerWhatsApp(e.target.value)}
                placeholder="01012345678"
                className="mt-1 font-mono"
              />
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-xs font-semibold text-foreground">
                {locale === "ar" ? "عنوان الشحن والتوصيل" : "Shipping Address"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={locale === "ar" ? "المحافظة *" : "Governorate *"}
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                />
                <Input
                  placeholder={locale === "ar" ? "المدينة / المركز *" : "City / District *"}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <Input
                placeholder={locale === "ar" ? "اسم الشارع والحي *" : "Street & Building *"}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <Input
                placeholder={locale === "ar" ? "علامة مميزة للعنوان" : "Address landmark / notes"}
                value={addressNotes}
                onChange={(e) => setAddressNotes(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <Label htmlFor="admin-cust-notes" className="text-xs font-semibold">
                {locale === "ar" ? "ملاحظات الطلب الخاصة" : "Order Notes"}
              </Label>
              <Textarea
                id="admin-cust-notes"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder={
                  locale === "ar"
                    ? "أي تعليمات إضافية للتوصيل أو التجهيز..."
                    : "Any special delivery instructions..."
                }
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Middle/Right Column: Product Selector, Lines & Totals */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="size-4 text-primary" />
                {locale === "ar" ? "المنتجات والمتغيرات المطلوبة" : "Order Items & Variants"}
              </CardTitle>
              <CardDescription>
                {locale === "ar"
                  ? "ابحث عن المنتجات وأضف المتغيرات وحدد طريقة الدفع"
                  : "Search products, select specific variants and assign payment method"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Search & Add Controls */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={
                      locale === "ar" ? "بحث في الكتالوج..." : "Search catalog products..."
                    }
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="ps-9"
                  />
                </div>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue
                      placeholder={locale === "ar" ? "اختر منتجاً..." : "Select product..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {searchableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {locale === "ar" ? p.nameAr || p.titleAr : p.nameEn || p.titleEn} (
                        {formatEGP(p.cashPrice)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!selectedProductId}
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  {locale === "ar" ? "إضافة" : "Add Item"}
                </Button>
              </div>

              {/* Items List Table */}
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  {locale === "ar"
                    ? "لم تتم إضافة أي منتجات بعد. اختر منتجاً من القائمة أعلاه واضغط إضافة."
                    : "No items added yet. Choose a product and click Add."}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.productId);
                    const variant = product?.variants?.find((v) => v.id === item.variantId);
                    const maxStock = variant?.stock ?? 0;

                    return (
                      <div
                        key={item.tempId}
                        className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-sm">
                              {locale === "ar"
                                ? product?.nameAr || product?.titleAr
                                : product?.nameEn || product?.titleEn}
                            </span>
                            {product?.pointsEnabled && (
                              <Badge variant="secondary" className="text-[10px]">
                                {locale === "ar" ? "يدعم النقاط" : "Points Enabled"}
                              </Badge>
                            )}
                          </div>

                          {/* Variant Selector */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Select
                              value={item.variantId}
                              onValueChange={(val) =>
                                handleUpdateItem(item.tempId, { variantId: val })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {product?.variants?.map((v) => (
                                  <SelectItem key={v.id} value={v.id} className="text-xs">
                                    {locale === "ar" ? v.nameAr : v.nameEn} (SKU: {v.sku} | المخزون:{" "}
                                    {v.stock})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Quantity */}
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[11px] text-muted-foreground">
                                {locale === "ar" ? "الكمية:" : "Qty:"}
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={maxStock > 0 ? maxStock : 99}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(item.tempId, {
                                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="h-8 w-16 text-center text-xs"
                              />
                            </div>

                            {/* Payment Method */}
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[11px] text-muted-foreground">
                                {locale === "ar" ? "الدفع:" : "Pay:"}
                              </Label>
                              <Select
                                value={item.productPaymentMethod}
                                onValueChange={(val) =>
                                  handleUpdateItem(item.tempId, {
                                    productPaymentMethod: val as "CASH" | "POINTS",
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CASH">
                                    {locale === "ar" ? "كاش" : "Cash"}
                                  </SelectItem>
                                  {product?.pointsEnabled && (
                                    <SelectItem value="POINTS">
                                      {locale === "ar" ? "نقاط" : "Points"}
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Price & Remove Button */}
                        <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0">
                          <div className="text-end">
                            <div className="font-bold text-sm">
                              {item.productPaymentMethod === "POINTS"
                                ? formatPoints(
                                    (variant?.pointsPrice ?? product?.defaultPointsPrice ?? 0) *
                                      item.quantity,
                                  )
                                : formatEGP(
                                    (variant?.cashPrice ?? product?.cashPrice ?? 0) * item.quantity,
                                  )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {locale === "ar" ? "المخزون المتوفر: " : "Stock: "} {maxStock}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.tempId)}
                            className="size-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shipping Payment Selection */}
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      {locale === "ar" ? "طريقة دفع الشحن" : "Shipping Payment Method"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {locale === "ar"
                        ? "اختر ما إذا كان العميل سيدفع الشحن نقداً (50 ج.م) أو بالنقاط (200 نقطة)"
                        : "Choose whether shipping is paid with Cash (50 EGP) or Points (200 pts)"}
                    </p>
                  </div>
                  <Select
                    value={shippingPaymentMethod}
                    onValueChange={(val) => setShippingPaymentMethod(val as "CASH" | "POINTS")}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">
                        {locale === "ar" ? "كاش (50 ج.م)" : "Cash (50 EGP)"}
                      </SelectItem>
                      <SelectItem value="POINTS">
                        {locale === "ar" ? "نقاط (200 نقطة)" : "Points (200 pts)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Summary & Totals Breakdown */}
              <div className="rounded-lg border border-border/80 bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {locale === "ar" ? "إجمالي المنتجات كاش:" : "Products Cash Subtotal:"}
                  </span>
                  <span>{formatEGP(totals.subtotalCash)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{locale === "ar" ? "رسوم الشحن:" : "Shipping Amount:"}</span>
                  <span>
                    {shippingPaymentMethod === "POINTS"
                      ? formatPoints(totals.shippingPoints)
                      : formatEGP(totals.shippingCash)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-foreground pt-1 border-t border-border/40">
                  <span>
                    {locale === "ar" ? "نمط التمويل المحسوب:" : "Calculated Funding Mode:"}
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {totals.fundingMode}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-border">
                  <span>
                    {locale === "ar" ? "المبلغ النقدي المطلوب (كاش):" : "Total Cash Due:"}
                  </span>
                  <span className="text-primary">{formatEGP(totals.totalCashDue)}</span>
                </div>
                {totals.totalPointsDue > 0 && (
                  <div className="flex items-center justify-between text-sm font-bold text-accent">
                    <span>{locale === "ar" ? "إجمالي النقاط المطلوبة:" : "Total Points Due:"}</span>
                    <span>{formatPoints(totals.totalPointsDue)}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                size="lg"
                className="w-full font-bold gap-2"
                onClick={() => placeOrderMutation.mutate()}
                disabled={placeOrderMutation.isPending || items.length === 0}
              >
                {placeOrderMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {locale === "ar" ? "تأكيد وإنشاء الطلب رسمياً" : "Confirm & Place Admin Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Confirmation Dialog */}
      {confirmation && (
        <Dialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-6" />
              </div>
              <DialogTitle className="text-center text-lg font-bold">
                {locale === "ar" ? "تم إنشاء الطلب بنجاح!" : "Order Created Successfully!"}
              </DialogTitle>
              <DialogDescription className="text-center font-mono font-bold text-foreground">
                #{confirmation.orderNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{locale === "ar" ? "العميل:" : "Customer:"}</span>
                  <span className="font-semibold text-foreground">{confirmation.customerName}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{locale === "ar" ? "رقم الهاتف:" : "Phone:"}</span>
                  <span className="font-mono text-foreground">{confirmation.customerPhone}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{locale === "ar" ? "نمط الطلب:" : "Funding Mode:"}</span>
                  <span className="font-mono font-semibold text-foreground">
                    {confirmation.fundingMode}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{locale === "ar" ? "إجمالي الكاش:" : "Total Cash:"}</span>
                  <span className="font-bold text-primary">{formatEGP(confirmation.cashDue)}</span>
                </div>
                {confirmation.pointsDue > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{locale === "ar" ? "إجمالي النقاط:" : "Total Points:"}</span>
                    <span className="font-bold text-accent">
                      {formatPoints(confirmation.pointsDue)}
                    </span>
                  </div>
                )}
              </div>

              {/* WhatsApp Confirmation Link */}
              <div className="pt-2">
                <Button
                  asChild
                  variant="outline"
                  className="w-full gap-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <a
                    href={`https://wa.me/20${confirmation.customerPhone.replace(/^0/, "")}?text=${encodeURIComponent(
                      locale === "ar"
                        ? `مرحباً ${confirmation.customerName}، تم تسجيل طلبك رقم #${confirmation.orderNumber} بقيمة ${formatEGP(confirmation.cashDue)} في متجر VEN+. سنتواصل معك قريباً لتأكيد الشحن.`
                        : `Hello ${confirmation.customerName}, your VEN+ order #${confirmation.orderNumber} of ${formatEGP(confirmation.cashDue)} has been placed. We will contact you shortly to confirm delivery.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    {locale === "ar"
                      ? "إرسال رسالة تأكيد عبر واتساب"
                      : "Send WhatsApp Confirmation"}
                  </a>
                </Button>
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="secondary" onClick={() => setConfirmation(null)}>
                {locale === "ar" ? "إغلاق" : "Close"}
              </Button>
              <Button onClick={resetForm}>
                {locale === "ar" ? "إنشاء طلب آخر" : "Create Another Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
