import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Coins,
  PackageCheck,
  Truck,
  UserPlus,
  Search,
  ArrowRight,
  Sparkles,
  Gift,
  ShoppingBag,
  ArrowLeft,
  ChevronRight,
  Tag,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { REFERRAL_REWARD_POINTS } from "@/lib/points-rules";
import {
  getCatalogPayload,
  type CatalogProduct,
  type PublicCategory,
} from "@/lib/catalog.functions";

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
  const { t, locale, formatEGP, formatPoints } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");

  const fetchCatalog = useServerFn(getCatalogPayload);
  const { data } = useQuery({
    queryKey: ["catalog-payload"],
    queryFn: () => fetchCatalog(),
  });

  const products: CatalogProduct[] = data?.products ?? [];
  const categories: PublicCategory[] = data?.categories ?? [];
  const featuredProducts = products.slice(0, 4);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      void navigate({
        to: "/products",
      });
    }
  };

  const steps = [
    {
      icon: PackageCheck,
      ar: "اطلب وادفع كاش أو بالنقاط",
      en: "Order and pay with cash or points",
      arBody: "مرونة كاملة في الدفع: يمكنك دفع المنتجات أو الشحن بالكاش أو بالنقاط بشكل مستقل.",
      enBody:
        "Total payment flexibility: pay for products or shipping in cash or points independently.",
    },
    {
      icon: Coins,
      ar: "اكسب النقاط عند استلام الطلب",
      en: "Earn points on delivery",
      arBody: "تُضاف نقاط المكافأة تلقائيًا إلى محفظتك فور وصول الطلب وتسليمه بنجاح.",
      enBody: "Bonus points are credited automatically to your wallet upon order delivery.",
    },
    {
      icon: Truck,
      ar: "استبدل النقاط في المنتجات والشحن",
      en: "Redeem points for products & shipping",
      arBody: "استخدم رصيد نقاطك المتراكم لشراء منتجاتك المفضلة أو تغطية مصاريف الشحن بالكامل.",
      enBody: "Use your accumulated points balance for products or to cover shipping costs.",
    },
    {
      icon: UserPlus,
      ar: `ادعُ أصدقاءك واكسب ${REFERRAL_REWARD_POINTS} نقطة`,
      en: `Invite friends & earn ${REFERRAL_REWARD_POINTS} points`,
      arBody: "شارك كود الإحالة الخاص بك؛ تُمنح المكافأة فور تسليم أول طلب لصديقك.",
      enBody:
        "Share your referral code; receive your reward upon your friend's first delivered order.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="space-y-16 pb-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/60 bg-sidebar text-sidebar-foreground">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,var(--color-accent),transparent_55%)]" />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20">
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className="bg-accent/20 text-accent font-bold px-3 py-1 text-xs"
              >
                <Sparkles className="size-3.5 me-1" />
                {locale === "ar"
                  ? "المتجر الأول في مصر بنظام مكافآت حقيقي"
                  : "Egypt's Premier Points & Rewards Store"}
              </Badge>
            </div>

            <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl tracking-tight">
              {t("tagline")}
            </h1>
            <p className="mt-4 max-w-xl text-sidebar-foreground/80 text-base sm:text-lg leading-relaxed">
              {t("heroBody")}
            </p>

            {/* Hero Search Bar */}
            <form onSubmit={handleSearchSubmit} className="mt-8 max-w-xl flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    locale === "ar"
                      ? "ابحث عن منتجك المفضل أو كود المنتج..."
                      : "Search for products or SKU..."
                  }
                  className="ps-10 pe-4 h-12 rounded-xl bg-background/90 text-foreground border-border text-sm shadow-sm"
                />
              </div>
              <Button asChild size="lg" className="rounded-xl h-12 px-6 font-bold">
                <Link to="/products">{locale === "ar" ? "تصفح الكتالوج" : "Browse"}</Link>
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              {loading ? null : session ? (
                <Button asChild size="lg" variant="secondary" className="rounded-xl font-bold">
                  <Link to="/account">{t("account")}</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" variant="secondary" className="rounded-xl font-bold">
                    <Link to="/auth">{t("signUp")}</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-xl border-sidebar-foreground/30 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10 font-bold"
                  >
                    <Link to="/auth">{t("signIn")}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Categories Section */}
        {categories.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {locale === "ar" ? "تسوق حسب التصنيف" : "Shop by Category"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === "ar"
                    ? "استكشف تشكيلاتنا المتنوعة"
                    : "Explore our curated collections"}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/products">
                  {locale === "ar" ? "عرض الكل" : "View All"}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to="/products"
                  className="group flex flex-col items-center justify-center p-4 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all text-center"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                    <Tag className="size-6" />
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    {locale === "ar" ? cat.nameAr : cat.nameEn}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Products Section */}
        {featuredProducts.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold text-accent border-accent/30"
                  >
                    {locale === "ar" ? "مختارات مميزة" : "Featured"}
                  </Badge>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {locale === "ar" ? "أحدث المنتجات والعروض" : "Latest Products & Deals"}
                </h2>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1 text-xs rounded-xl">
                <Link to="/products">
                  {locale === "ar" ? "كل المنتجات" : "All Products"}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((p) => (
                <Card
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border-border/80 bg-card hover:shadow-md transition-all"
                >
                  <Link
                    to="/products/$slug"
                    params={{ slug: p.slug }}
                    className="relative aspect-square w-full bg-muted/20 overflow-hidden block"
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={locale === "ar" ? p.nameAr : p.nameEn}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground/40">
                        <ShoppingBag className="size-10" />
                      </div>
                    )}
                    <Badge className="absolute top-2.5 start-2.5 bg-emerald-600 text-white text-[10px] font-semibold gap-1">
                      <Gift className="size-3" />+{p.deliveryPointsReward}{" "}
                      {locale === "ar" ? "نقطة" : "pts"}
                    </Badge>
                  </Link>

                  <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      {p.categoryNameAr && (
                        <span className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                          {locale === "ar" ? p.categoryNameAr : p.categoryNameEn}
                        </span>
                      )}
                      <h3 className="text-sm font-bold line-clamp-1">
                        <Link
                          to="/products/$slug"
                          params={{ slug: p.slug }}
                          className="hover:text-primary transition"
                        >
                          {locale === "ar" ? p.nameAr : p.nameEn}
                        </Link>
                      </h3>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <span className="text-sm font-bold">{formatEGP(p.cashPrice)}</span>
                      {p.pointsEnabled && p.defaultPointsPrice && (
                        <Badge variant="secondary" className="gap-1 text-[11px]">
                          <Coins className="size-3 text-accent" />
                          {formatPoints(p.defaultPointsPrice)}
                        </Badge>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl text-xs"
                    >
                      <Link to="/products/$slug" params={{ slug: p.slug }}>
                        {locale === "ar" ? "عرض التفاصيل" : "View Details"}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* How It Works Steps */}
        <section className="mx-auto w-full max-w-6xl px-4">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl font-bold tracking-tight">
              {locale === "ar" ? "كيف يعمل نظام النقاط في VEN+؟" : "How VEN+ Rewards Work"}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              {locale === "ar"
                ? "تجربة تسوق فريدة تمنحك قيمة حقيقية مع كل طلب تستلمه."
                : "A unique shopping experience rewarding you on every delivered order."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <Card key={step.en} className="h-full rounded-2xl border-border/70 bg-card">
                <CardHeader className="pb-2">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent mb-2">
                    <step.icon className="size-5" />
                  </div>
                  <CardTitle className="text-base font-bold">
                    {locale === "ar" ? step.ar : step.en}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    {locale === "ar" ? step.arBody : step.enBody}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground bg-muted/20">
        {t("brand")} — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
