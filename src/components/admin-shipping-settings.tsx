import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Save, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import {
  getAdminShippingSettings,
  updateAdminShippingSettings,
} from "@/lib/admin-products.functions";

export function AdminShippingSettings() {
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const fetchSettings = useServerFn(getAdminShippingSettings);
  const saveSettings = useServerFn(updateAdminShippingSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-shipping-settings"],
    queryFn: () => fetchSettings(),
  });

  const [cashPrice, setCashPrice] = useState<number>(80);
  const [pointsPrice, setPointsPrice] = useState<number>(400);
  const [deliveryDuration, setDeliveryDuration] = useState<string>("2-5 days");

  useEffect(() => {
    if (data) {
      setCashPrice(data.globalShippingPrice);
      setPointsPrice(data.shippingPointsPrice);
      setDeliveryDuration(data.expectedDeliveryDuration);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (values: {
      globalShippingPrice: number;
      shippingPointsPrice: number;
      expectedDeliveryDuration: string;
    }) => saveSettings({ data: values }),
    onSuccess: (updated) => {
      setCashPrice(updated.globalShippingPrice);
      setPointsPrice(updated.shippingPointsPrice);
      setDeliveryDuration(updated.expectedDeliveryDuration);
      void queryClient.invalidateQueries({ queryKey: ["admin-shipping-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success(
        locale === "ar" ? "تم حفظ إعدادات الشحن بنجاح" : "Shipping settings saved successfully",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "INTERNAL_ERROR");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (cashPrice < 0 || isNaN(cashPrice)) {
      toast.error(locale === "ar" ? "سعر الشحن كاش غير صالح" : "Invalid cash shipping price");
      return;
    }
    if (pointsPrice < 0 || !Number.isInteger(pointsPrice) || isNaN(pointsPrice)) {
      toast.error(
        locale === "ar"
          ? "سعر الشحن بالنقاط يجب أن يكون رقماً صحيحاً"
          : "Points shipping price must be an integer",
      );
      return;
    }
    if (!deliveryDuration.trim()) {
      toast.error(locale === "ar" ? "مدة التوصيل مطلوبة" : "Delivery duration is required");
      return;
    }

    mutation.mutate({
      globalShippingPrice: Number(cashPrice),
      shippingPointsPrice: Math.round(Number(pointsPrice)),
      expectedDeliveryDuration: deliveryDuration.trim(),
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          <CardTitle className="text-xl">
            {locale === "ar" ? "إعدادات الشحن والتوصيل" : "Shipping & Delivery Settings"}
          </CardTitle>
        </div>
        <CardDescription>
          {locale === "ar"
            ? "تحديد سعر الشحن النقدي الافتراضي، تكلفة الشحن بالنقاط، ومدة التوصيل المتوقعة لجميع الطلبات."
            : "Configure the cash shipping fee, points shipping cost, and expected delivery duration for all orders."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cash-price">
              {locale === "ar" ? "سعر الشحن كاش (ج.م)" : "Cash Shipping Price (EGP)"}
            </Label>
            <Input
              id="cash-price"
              type="number"
              min="0"
              step="0.5"
              required
              value={cashPrice}
              onChange={(e) => setCashPrice(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? `القيمة الافتراضية: 80 ج.م. يُدفع عند اختيار العميل للشحن كاش.`
                : `Default: 80 EGP. Charged when the customer chooses cash shipping.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="points-price">
              {locale === "ar" ? "سعر الشحن بالنقاط (نقطة)" : "Points Shipping Price (Points)"}
            </Label>
            <Input
              id="points-price"
              type="number"
              min="0"
              step="1"
              required
              value={pointsPrice}
              onChange={(e) => setPointsPrice(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? `القيمة الافتراضية: 400 نقطة. يُخصم من رصيد العميل مقابل جعل الشحن مجاني كاش (0 ج.م).`
                : `Default: 400 points. Deducted from the customer's balance to make cash shipping 0 EGP.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-duration">
              {locale === "ar" ? "مدة التوصيل المتوقعة" : "Expected Delivery Duration"}
            </Label>
            <Input
              id="delivery-duration"
              type="text"
              required
              placeholder="2-5 days / 2-5 أيام"
              value={deliveryDuration}
              onChange={(e) => setDeliveryDuration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "تظهر في السلة وعند إتمام الطلب وتُسجَّل في لقطة الطلب."
                : "Displayed in the cart, checkout, and recorded in the order snapshot."}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-xs space-y-1 text-muted-foreground">
            <p className="font-semibold text-foreground">
              {locale === "ar" ? "ملخص طريقة الدفع للشحن:" : "Shipping Payment Summary:"}
            </p>
            <p>
              • {locale === "ar" ? "شحن كاش: " : "Cash Shipping: "}
              <strong className="text-foreground">{formatEGP(cashPrice)}</strong>
            </p>
            <p>
              • {locale === "ar" ? "شحن بالنقاط: " : "Points Shipping: "}
              <strong className="text-foreground">{formatPoints(pointsPrice)}</strong>
              {locale === "ar" ? " (الشحن كاش = 0 ج.م)" : " (Cash Shipping = 0 EGP)"}
            </p>
          </div>

          <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto gap-2">
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {locale === "ar" ? "حفظ إعدادات الشحن" : "Save Shipping Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
