import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { checkReferralCode } from "@/lib/account.functions";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to VEN+ | Points account access" },
      {
        name: "description",
        content:
          "Sign in or create your VEN+ account to track points, referrals, and orders paid with cash or points.",
      },
      { property: "og:title", content: "Sign in to VEN+" },
      {
        property: "og:description",
        content: "Access your VEN+ points balance, referral code, and order history.",
      },
    ],
  }),
  component: AuthPage,
});

/** Only same-origin relative paths are accepted as post-auth destinations. */
function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/account";
  return value;
}

function AuthPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const search = Route.useSearch();
  const destination = safeRedirect(search.redirect);

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: destination, replace: true });
    }
  }, [loading, session, destination, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("brand")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
            <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <SignInCard destination={destination} />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpCard locale={locale} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function GoogleButton() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (result.error) {
          toast.error(result.error.message);
          setBusy(false);
          return;
        }
        if (result.redirected) return;
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {t("continueWithGoogle")}
    </Button>
  );
}

function SignInCard({ destination }: { destination: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signIn")}</CardTitle>
        <CardDescription>{t("tagline")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            setBusy(false);
            if (error) {
              toast.error(error.message);
              return;
            }
            void navigate({ to: destination, replace: true });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="signin-email">{t("email")}</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">{t("password")}</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("signIn")}
          </Button>
        </form>

        <GoogleButton />

        <Button
          type="button"
          variant="link"
          className="w-full text-muted-foreground"
          onClick={async () => {
            if (!email) {
              toast.info(t("email"));
              return;
            }
            await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/auth`,
            });
            toast.success(t("authGenericNotice"));
          }}
        >
          {t("forgotPassword")}
        </Button>
      </CardContent>
    </Card>
  );
}

function SignUpCard({ locale }: { locale: "ar" | "en" }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    referralCode: "",
  });
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signUp")}</CardTitle>
        <CardDescription>{t("referralHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              const code = form.referralCode.trim().toUpperCase();
              if (code) {
                const { valid } = await checkReferralCode({ data: { code } });
                if (!valid) {
                  toast.error(t("referralCode"));
                  return;
                }
              }
              const { error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                  emailRedirectTo: `${window.location.origin}/account`,
                  data: {
                    full_name: form.fullName,
                    phone: form.phone,
                    locale,
                    referral_code: code || null,
                  },
                },
              });
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success(t("checkInbox"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="signup-name">{t("fullName")}</Label>
            <Input id="signup-name" required minLength={2} value={form.fullName} onChange={update("fullName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">{t("email")}</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update("email")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">{t("password")}</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={update("password")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-phone">{t("phone")}</Label>
            <Input
              id="signup-phone"
              inputMode="numeric"
              placeholder="01xxxxxxxxx"
              pattern="01[0-9]{9}"
              value={form.phone}
              onChange={update("phone")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-referral">{t("referralCode")}</Label>
            <Input
              id="signup-referral"
              value={form.referralCode}
              onChange={update("referralCode")}
              className="uppercase"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("signUp")}
          </Button>
        </form>

        <GoogleButton />

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            {t("brand")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
