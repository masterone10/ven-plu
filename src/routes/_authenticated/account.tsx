import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Gift, History, Loader2, LogOut, Package, User, Wallet } from "lucide-react";
import { getAccountOverview, updateMyProfile } from "@/lib/account.functions";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حسابي — نقاطي، الإحالات، الملف الشخصي" },
      {
        name: "description",
        content:
          "عرض رصيد نقاط VEN+، سجل حركات النقاط، كود الإحالة الخاص بك، وتحديث بيانات التواصل.",
      },
      { property: "og:title", content: "حسابي في VEN+" },
      {
        property: "og:description",
        content: "رصيد نقاطك وسجل النقاط وكود الإحالة وإدارة الحساب.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t, formatPoints, ledgerLabel, locale } = useI18n();
  const fetchOverview = useServerFn(getAccountOverview);
  const router = useRouter();

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
          <span>{locale === "ar" ? "جاري تحميل بيانات الحساب..." : t("loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
          <p className="text-sm font-semibold text-destructive">
            {error instanceof Error ? error.message : "Error"}
          </p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
            {locale === "ar" ? "إعادة المحاولة" : "Retry"}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              {locale === "ar" ? "حسابي" : "My Account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "إدارة رصيد النقاط، كود الإحالة، والبيانات الشخصية."
                : "Manage your points balance, referral code, and personal details."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/orders">
                <Package className="me-2 size-4" />
                {locale === "ar" ? "طلباتي" : "My orders"}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={async () => {
                await supabase.auth.signOut();
                await router.navigate({ to: "/auth" });
              }}
            >
              <LogOut className="me-2 size-4" />
              {locale === "ar" ? "تسجيل الخروج" : "Log out"}
            </Button>
          </div>
        </div>

        {/* Top Cards: Points & Referral Code */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-accent/40 bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-primary-foreground/70">
                <Wallet className="size-4" />
                {locale === "ar" ? "رصيد النقاط الحالي" : t("pointsBalance")}
              </CardDescription>
              <CardTitle className="text-4xl font-black">
                {formatPoints(data.pointsBalance)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-primary-foreground/70">
                {locale === "ar"
                  ? "يمكنك استخدام النقاط لدفع قيمة المنتجات أو الشحن عند إتمام الطلب."
                  : "Use points towards products or shipping at checkout."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Gift className="size-4 text-accent" />
                {locale === "ar" ? "كود الإحالة الخاص بك" : t("myReferralCode")}
              </CardDescription>
              <CardTitle className="flex items-center gap-2 font-mono text-2xl tracking-widest text-primary">
                {data.profile.referralCode}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("myReferralCode")}
                  onClick={async () => {
                    await navigator.clipboard.writeText(data.profile.referralCode);
                    toast.success(locale === "ar" ? "تم نسخ كود الإحالة" : t("saved"));
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t("referralHint")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Profile Details Card */}
        <ProfileCard profile={data.profile} currentLocale={locale} />

        {/* Points History Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-accent" />
              {locale === "ar" ? "سجل النقاط" : t("pointsHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ledger.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {locale === "ar" ? "لا توجد حركات نقاط سابقة حتى الآن." : t("noPointsYet")}
              </p>
            ) : (
              data.ledger.map((entry, index) => (
                <div key={entry.id}>
                  {index > 0 ? <Separator className="mb-3" /> : null}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{ledgerLabel(entry.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString(
                          locale === "ar" ? "ar-EG" : "en-GB",
                        )}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={entry.delta > 0 ? "default" : "secondary"}
                      className={entry.delta > 0 ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
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
      toast.success(locale === "ar" ? "تم حفظ التغييرات بنجاح" : t("saved"));
      setLocale(currentLocale);
      void queryClient.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (mutationError: unknown) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Error");
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4 text-accent" />
          {locale === "ar" ? "الملف الشخصي" : t("profile")}
        </CardTitle>
        <CardDescription>{profile.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="account-name">{locale === "ar" ? "الاسم الكامل" : t("fullName")}</Label>
            <Input
              id="account-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-phone">{locale === "ar" ? "رقم الهاتف" : t("phone")}</Label>
            <Input
              id="account-phone"
              inputMode="numeric"
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {locale === "ar" ? "حفظ التغييرات" : t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
