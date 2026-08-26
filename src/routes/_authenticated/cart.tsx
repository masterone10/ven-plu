import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getCart,
  removeCartItem,
  setCartPaymentMethod,
  updateCartItem,
  type CartItemView,
} from "@/lib/cart.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({
    meta: [
      { title: "Your VEN+ cart" },
      {
        name: "description",
        content:
          "Review your VEN+ cart, switch between paying in EGP or with points, and continue to checkout.",
      },
      { property: "og:title", content: "Your VEN+ cart" },
      { property: "og:description", content: "Review your VEN+ cart and continue to checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const fetchCart = useServerFn(getCart);
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({ queryKey: ["cart"], queryFn: () => fetchCart() });

  const update = useServerFn(updateCartItem);
  const remove = useServerFn(removeCartItem);
  const setMethod = useServerFn(setCartPaymentMethod);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["cart"] });
  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "INTERNAL_ERROR");

  const updateMutation = useMutation({
    mutationFn: (input: { itemId: string; quantity?: number; paymentMethod?: "CASH" | "POINTS" }) =>
      update({ data: input }),
    onSuccess: invalidate,
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => remove({ data: { itemId } }),
    onSuccess: invalidate,
    onError,
  });
  const bulkMutation = useMutation({
    mutationFn: (paymentMethod: "CASH" | "POINTS") => setMethod({ data: { paymentMethod } }),
    onSuccess: invalidate,
    onError,
  });

  const items = data?.items ?? [];
  const cashTotal = items.reduce((sum, item) => sum + item.lineCashTotal, 0);
  const pointsTotal = items.reduce((sum, item) => sum + item.linePointsTotal, 0);
  const hasConflictingMethods = items.some((i) => i.paymentMethod === "CASH") && items.some((i) => i.paymentMethod === "POINTS");
  const blocked = items.some((item) => item.issue !== null);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-black tracking-tight">
          {locale === "ar" ? "سلة الشراء" : "Your cart"}
        </h1>

        {isPending ? (
          <Loader2 className="mt-8 size-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            {locale === "ar" ? "السلة فاضية. " : "Your cart is empty. "}
            <Link to="/products" className="font-medium text-accent underline">
              {locale === "ar" ? "تصفح المنتجات" : "Browse products"}
            </Link>
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <CartRow
                key={item.id}
                item={item}
                busy={updateMutation.isPending || removeMutation.isPending}
                onQuantity={(quantity) => updateMutation.mutate({ itemId: item.id, quantity })}
                onMethod={(paymentMethod) =>
                  updateMutation.mutate({ itemId: item.id, paymentMethod })
                }
                onRemove={() => removeMutation.mutate(item.id)}
              />
            ))}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {locale === "ar" ? "الملخص" : "Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {locale === "ar" ? "إجمالي الكاش" : "Cash items"}
                  </span>
                  <span className="font-semibold">{formatEGP(cashTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {locale === "ar" ? "إجمالي النقاط" : "Points items"}
                  </span>
                  <span className="font-semibold">{formatPoints(pointsTotal)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {locale === "ar" ? "رصيدك" : "Your balance"}
                  </span>
                  <span className="font-semibold">{formatPoints(data?.pointsBalance ?? 0)}</span>
                </div>

                {hasConflictingMethods ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                    <p>
                      {locale === "ar"
                        ? "الطلب لا يقبل الخلط: خليه كله كاش أو كله نقاط."
                        : "An order cannot mix funding: make it all cash or all points."}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkMutation.isPending}
                        onClick={() => bulkMutation.mutate("CASH")}
                      >
                        {locale === "ar" ? "الكل كاش" : "All cash"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          bulkMutation.isPending || items.some((item) => !item.pointsEnabled)
                        }
                        onClick={() => bulkMutation.mutate("POINTS")}
                      >
                        {locale === "ar" ? "الكل نقاط" : "All points"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <Button asChild className="w-full" disabled={hasConflictingMethods || blocked}>
                  <Link to="/checkout">{locale === "ar" ? "إتمام الطلب" : "Checkout"}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function CartRow({
  item,
  busy,
  onQuantity,
  onMethod,
  onRemove,
}: {
  item: CartItemView;
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onMethod: (paymentMethod: "CASH" | "POINTS") => void;
  onRemove: () => void;
}) {
  const { locale, formatEGP, formatPoints } = useI18n();
  const productName = locale === "ar" ? item.productNameAr : item.productNameEn;
  const variantName = locale === "ar" ? item.variantNameAr : item.variantNameEn;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={productName}
            loading="lazy"
            className="size-16 rounded-md object-cover"
          />
        ) : null}

        <div className="min-w-40 flex-1">
          <p className="font-semibold">{productName}</p>
          <p className="text-xs text-muted-foreground">
            {variantName} · {item.sku}
          </p>
          {item.issue ? (
            <Badge variant="destructive" className="mt-1">
              {item.issue}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            disabled={busy || item.quantity <= 1}
            aria-label={locale === "ar" ? "تقليل" : "Decrease"}
            onClick={() => onQuantity(item.quantity - 1)}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            disabled={busy || item.quantity >= item.stock}
            aria-label={locale === "ar" ? "زيادة" : "Increase"}
            onClick={() => onQuantity(item.quantity + 1)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={item.paymentMethod === "CASH" ? "default" : "outline"}
            disabled={busy}
            onClick={() => onMethod("CASH")}
          >
            {locale === "ar" ? "كاش" : "Cash"}
          </Button>
          <Button
            size="sm"
            variant={item.paymentMethod === "POINTS" ? "default" : "outline"}
            disabled={busy || !item.pointsEnabled}
            onClick={() => onMethod("POINTS")}
          >
            <Coins className="size-3.5" />
            {locale === "ar" ? "نقاط" : "Points"}
          </Button>
        </div>

        <div className="w-28 text-end text-sm font-semibold">
          {item.paymentMethod === "POINTS"
            ? formatPoints(item.linePointsTotal)
            : formatEGP(item.lineCashTotal)}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          disabled={busy}
          aria-label={locale === "ar" ? "حذف" : "Remove"}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
