import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  Download,
  Gift,
  Globe,
  Loader2,
  LogOut,
  Package,
  ShoppingBag,
  User,
  Wallet,
} from "lucide-react";
import { getAccountOverview, updateMyProfile } from "@/lib/account.functions";
import { listCatalog, type CatalogProduct } from "@/lib/catalog.functions";
import { downloadProductPackage } from "@/lib/product-package.functions";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حسابي | VEN+ Account" },
      {
        name: "description",
        content: "رصيد النقاط، سجل المعاملات، كود الإحالة، وتعديل بيانات الملف الشخصي.",
      },
      { property: "og:title", content: "حسابي | VEN+" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t, formatPoints, ledgerLabel, locale, setLocale } = useI18n();
  const { signOut } = useSession();
  const router = useRouter();
  const fetchOverview = useServerFn(getAccountOverview);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => fetchOverview(),
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-accent" />
          <span>{locale === "ar" ? "جاري تحميل الحساب..." : "Loading account..."}</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-md py-24 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Error loading account"}
          </p>
        </div>
      </div>
    );
  }

  const handleCopyReferral = async () => {
    await navigator.clipboard.writeText(data.profile.referralCode);
    setCopiedReferral(true);
    toast.success(locale === "ar" ? "تم نسخ كود الإحالة" : "Referral code copied");
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    void router.navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        {/* Top greeting & actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {locale === "ar" ? "حسابي ونقاط المكافآت" : "My Account & Points"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? `مرحبًا، ${data.profile.fullName || data.profile.email || "عميلنا المميز"}`
                : `Welcome, ${data.profile.fullName || data.profile.email || "Customer"}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="gap-1.5 text-xs">
              <Link to="/orders">
                <Package className="size-4" />
                {locale === "ar" ? "عرض طلباتي" : "My Orders"}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="size-3.5" />
              {locale === "ar" ? "تسجيل خروج" : "Sign Out"}
            </Button>
          </div>
        </div>

        {/* Top metrics cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Points balance */}
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 font-bold text-accent">
                <Coins className="size-4" />
                {locale === "ar" ? "رصيد النقاط الحالي" : "Available Points Balance"}
              </CardDescription>
              <CardTitle className="text-3xl font-black text-foreground">
                {formatPoints(data.pointsBalance)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {locale === "ar"
                  ? "يمكنك استخدام نقاطك لدفع ثمن المنتجات أو مصاريف الشحن."
                  : "Use points to pay for products or free shipping at checkout."}
              </p>
            </CardContent>
          </Card>

          {/* Referral Code */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 font-bold text-primary">
                <Gift className="size-4" />
                {locale === "ar" ? "كود الإحالة الخاص بك" : "Your Referral Code"}
              </CardDescription>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black tracking-widest text-foreground">
                  {data.profile.referralCode}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleCopyReferral}
                >
                  {copiedReferral ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {locale === "ar" ? "نسخ الكود" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {locale === "ar"
                  ? "شارك كودك مع أصدقائك لتحصل على نقاط إضافية عند تسجيلهم وطلبهم لأول مرة."
                  : "Share with friends to earn bonus points when they register and place orders."}
              </p>
            </CardContent>
          </Card>

          {/* Orders link card */}
          <Card className="flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 font-bold text-foreground">
                <ShoppingBag className="size-4 text-accent" />
                {locale === "ar" ? "متابعة الطلبات" : "Track Orders"}
              </CardDescription>
              <CardTitle className="text-lg">
                {locale === "ar" ? "سجل ومتابعة الشحنات" : "Order History"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Button asChild className="w-full gap-1.5" size="sm">
                <Link to="/orders">
                  <Package className="size-3.5" />
                  {locale === "ar" ? "عرض جميع طلباتي" : "View All Orders"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Profile Card */}
        <ProfileCard profile={data.profile} currentLocale={locale} />

        {/* Points History Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {locale === "ar" ? "سجل حركات النقاط" : "Points Ledger & History"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {locale === "ar"
                    ? "تفاصيل النقاط المكتسبة من استلام الطلبات والنقاط المخصومة في عمليات الشراء."
                    : "Points credited from deliveries and points redeemed on orders."}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.ledger.length} {locale === "ar" ? "معاملة" : "entries"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ledger.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Coins className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p>
                  {locale === "ar" ? "لا توجد معاملات نقاط سابقة بعد" : "No points history yet."}
                </p>
                <p className="text-xs">
                  {locale === "ar"
                    ? "اطلب الآن واكسب نقاطًا عند استلام كل طلب!"
                    : "Place orders to start earning reward points upon delivery!"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {data.ledger.map((entry) => {
                  const isPositive = entry.delta > 0;
                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowDownLeft className="size-4" />
                          ) : (
                            <ArrowUpRight className="size-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">
                            {ledgerLabel(entry.type)}
                          </p>
                          {entry.note ? (
                            <p className="text-xs text-muted-foreground">{entry.note}</p>
                          ) : null}
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString(
                              locale === "ar" ? "ar-EG" : "en-GB",
                            )}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={isPositive ? "default" : "secondary"}
                        className={`font-mono text-xs font-bold ${
                          isPositive
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {entry.delta}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Downloads / Product Packages Card */}
        <DownloadsCard currentLocale={locale} />
      </main>
    </div>
  );
}

function DownloadsCard({ currentLocale }: { currentLocale: "ar" | "en" }) {
  const fetchCatalog = useServerFn(listCatalog);
  const downloadPkg = useServerFn(downloadProductPackage);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["downloadable-products"],
    queryFn: () => fetchCatalog(),
  });

  const handleDownload = async (product: CatalogProduct) => {
    setDownloadingId(product.id);
    try {
      const res = await downloadPkg({ data: { productId: product.id } });
      const byteCharacters = atob(res.contentBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(
        currentLocale === "ar"
          ? `تم تحميل ملفات ${product.nameAr} بنجاح`
          : `Downloaded package for ${product.nameEn}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : currentLocale === "ar"
            ? "فشل في تحميل حزمة المنتج"
            : "Failed to download product package",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {currentLocale === "ar" ? "تحميلات المنتجات والميديا" : "Product Downloads & Media"}
            </CardTitle>
            <CardDescription className="text-xs">
              {currentLocale === "ar"
                ? "تنزيل حزم المنتجات المصرح بها، الصور الأصلية، والبيانات الوصفية بصيغة ZIP."
                : "Download authorized product packages, high-res images, and JSON manifests."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs gap-1">
            <Download className="size-3" />
            {currentLocale === "ar" ? "حزم ZIP" : "ZIP Packages"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>
              {currentLocale === "ar" ? "جاري تحميل قائمة المنتجات..." : "Loading products..."}
            </span>
          </div>
        ) : !products || products.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <p>
              {currentLocale === "ar"
                ? "لا توجد منتجات متاحة للتحميل حاليًا"
                : "No downloadable products available."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.slice(0, 8).map((prod) => (
              <div
                key={prod.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/80 p-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.nameAr}
                      className="size-12 rounded object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded bg-muted text-muted-foreground shrink-0">
                      <Package className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm">
                      {currentLocale === "ar" ? prod.nameAr : prod.nameEn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {prod.variants.length}{" "}
                      {currentLocale === "ar" ? "خيارات/متغيرات" : "variants"}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0 text-xs font-bold"
                  disabled={downloadingId === prod.id}
                  onClick={() => handleDownload(prod)}
                >
                  {downloadingId === prod.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5 text-primary" />
                  )}
                  {currentLocale === "ar" ? "تحميل المنتج" : "Download"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileCard({
  profile,
  currentLocale,
}: {
  profile: { fullName: string | null; phone: string | null; email: string | null; locale: string };
  currentLocale: "ar" | "en";
}) {
  const { t, setLocale, locale } = useI18n();
  const queryClient = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  useEffect(() => {
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone ?? "");
  }, [profile.fullName, profile.phone]);

  const mutation = useMutation({
    mutationFn: () => saveProfile({ data: { fullName, phone, locale: currentLocale } }),
    onSuccess: () => {
      toast.success(locale === "ar" ? "تم حفظ بيانات الحساب بنجاح" : "Profile saved successfully");
      void queryClient.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (mutationError: unknown) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Error saving profile");
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {locale === "ar" ? "البيانات الشخصية" : "Personal Information"}
        </CardTitle>
        <CardDescription className="text-xs">
          {profile.email ? `البريد الإلكتروني: ${profile.email}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="account-name">{locale === "ar" ? "الاسم" : "Full Name"}</Label>
            <Input
              id="account-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-phone">{locale === "ar" ? "رقم الهاتف" : "Phone Number"}</Label>
            <Input
              id="account-phone"
              inputMode="numeric"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending} className="gap-2 font-bold">
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {locale === "ar" ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
