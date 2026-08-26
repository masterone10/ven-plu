import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, PackageCheck, Truck, UserPlus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { REFERRAL_REWARD_POINTS } from "@/lib/points-rules";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VEN+ | Shop in EGP or spend your points" },
      {
        name: "description",
        content:
          "VEN+ is an Egyptian storefront with a built-in points wallet: earn points on delivered orders and pay for products or shipping with points.",
      },
      { property: "og:title", content: "VEN+ | Shop in EGP or spend your points" },
      {
        property: "og:description",
        content:
          "Earn points on every delivered VEN+ order and redeem them for products or shipping.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const { session, loading } = useSession();

  const steps = [
    {
      icon: PackageCheck,
      ar: "اطلب وادفع كاش أو بالنقاط",
      en: "Order and pay with cash or with points",
      arBody: "كل طلب يكون بالكامل كاش أو بالكامل نقاط — لا خلط بين الطريقتين.",
      enBody: "Each order is fully cash or fully points — the two are never mixed.",
    },
    {
      icon: Coins,
      ar: "اكسب النقاط عند التسليم",
      en: "Earn points on delivery",
      arBody: "تُضاف النقاط فقط عندما يصل الطلب لحالة «تم التسليم»، ولا تُضاف للطلبات الملغاة.",
      enBody: "Points are credited only when an order reaches DELIVERED, never for cancelled orders.",
    },
    {
      icon: Truck,
      ar: "استبدل النقاط في الشحن",
      en: "Redeem points on shipping",
      arBody: "استخدم رصيدك في المنتجات أو في الشحن حسب إعدادات المتجر.",
      enBody: "Spend your balance on products or shipping, based on store settings.",
    },
    {
      icon: UserPlus,
      ar: `ادعُ صديقًا واكسب ${REFERRAL_REWARD_POINTS} نقطة`,
      en: `Invite a friend and earn ${REFERRAL_REWARD_POINTS} points`,
      arBody: "تُمنح المكافأة عند أول طلب يُسلَّم لمن استخدم كود الإحالة الخاص بك.",
      enBody: "The reward lands when your referee's first order is delivered.",
    },
  ];

  const { locale } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border/60 bg-sidebar text-sidebar-foreground">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,var(--color-accent),transparent_55%)]" />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              {t("brand")}
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
              {t("tagline")}
            </h1>
            <p className="mt-4 max-w-xl text-sidebar-foreground/80">{t("heroBody")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {loading ? null : session ? (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/account">{t("account")}</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" variant="secondary">
                    <Link to="/auth">{t("signUp")}</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-sidebar-foreground/30 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10"
                  >
                    <Link to="/auth">{t("signIn")}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <Card key={step.en} className="h-full">
              <CardHeader className="pb-2">
                <step.icon className="size-5 text-accent" />
                <CardTitle className="text-base">{locale === "ar" ? step.ar : step.en}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {locale === "ar" ? step.arBody : step.enBody}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        {t("brand")} — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
