import { Link } from "@tanstack/react-router";
import { Languages, Moon, Sparkles, Sun, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePointsBalance } from "@/hooks/use-points-balance";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { t, toggleLocale, formatPoints, locale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { session, loading } = useSession();
  const isAdmin = useIsAdmin();
  const { balance } = usePointsBalance();

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
          {session && balance !== null ? (
            <Link
              to="/account"
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold text-accent transition-colors hover:bg-accent/20"
              title={locale === "ar" ? "رصيد النقاط الحالي" : "Current Points Balance"}
            >
              <Sparkles className="size-3.5 text-accent" />
              <span>{formatPoints(balance)}</span>
            </Link>
          ) : null}

          <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label={t("language")}>
            <Languages className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t("theme")}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {loading ? null : session ? (
            <>
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
