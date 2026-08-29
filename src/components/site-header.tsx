import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Languages, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { t, locale, toggleLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { session, loading } = useSession();
  const isAdmin = useIsAdmin();

  const { data: pointsData } = useQuery({
    queryKey: ["navbar-points", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return 0;
      const { data, error } = await supabase
        .from("points_balances")
        .select("balance")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) return 0;
      return data?.balance ?? 0;
    },
    enabled: !!session?.user?.id,
    staleTime: 10000,
  });

  const pointsBalance = pointsData ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          to="/"
          dir="ltr"
          className="flex items-baseline gap-1 text-xl font-black tracking-tight"
        >
          <span className="text-foreground">VEN</span>
          <span className="text-accent">+</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/products">{t("products")}</Link>
          </Button>
          {session ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/cart">{t("cart")}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/orders">{t("orders")}</Link>
              </Button>
              {isAdmin ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/products">{t("adminProducts")}</Link>
                </Button>
              ) : null}
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label={t("language")}>
            <Languages className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t("theme")}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {loading ? null : session ? (
            <>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-primary/25 bg-primary/5 font-semibold text-primary hover:bg-primary/10"
              >
                <Link to="/account">
                  <Coins className="size-3.5 text-primary" />
                  <span>
                    {locale === "ar" ? `${pointsBalance} نقطة` : `${pointsBalance} Points`}
                  </span>
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link to="/account">{t("account")}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void supabase.auth.signOut();
                }}
              >
                {t("signOut")}
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">{t("signIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
