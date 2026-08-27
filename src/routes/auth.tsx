import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkReferralCode } from "@/lib/account.functions";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-session";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z
    .enum(["signin", "signup", "forgot-password", "reset-password", "resend-confirmation"])
    .optional(),
  confirmed: z.string().optional(),
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

  const [authView, setAuthView] = useState<
    "signin" | "signup" | "forgot-password" | "reset-password" | "resend-confirmation"
  >(search.mode ?? "signin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Check URL hash for Supabase auth events (e.g., type=recovery or error_description)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const errorDesc = params.get("error_description");
      const type = params.get("type");

      if (errorDesc) {
        setErrorMessage(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
      } else if (type === "recovery") {
        setAuthView("reset-password");
      }
    }

    if (search.confirmed === "true") {
      setSuccessNotice(t("accountConfirmed"));
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthView("reset-password");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [search.confirmed, t]);

  useEffect(() => {
    // Only redirect if signed in and NOT in the middle of a password reset recovery
    if (!loading && session && authView !== "reset-password") {
      void navigate({ to: destination, replace: true });
    }
  }, [loading, session, destination, navigate, authView]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("brand")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{locale === "ar" ? "خطأ في المصادقة" : "Authentication Error"}</AlertTitle>
            <AlertDescription className="mt-1 flex flex-col gap-2">
              <span>{errorMessage}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit text-xs"
                onClick={() => {
                  setErrorMessage(null);
                  setAuthView("resend-confirmation");
                }}
              >
                {t("resendConfirmation")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {successNotice && (
          <Alert className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle>{locale === "ar" ? "تم بنجاح" : "Success"}</AlertTitle>
            <AlertDescription>{successNotice}</AlertDescription>
          </Alert>
        )}

        {authView === "reset-password" ? (
          <ResetPasswordCard
            onSuccess={() => {
              setSuccessNotice(t("passwordUpdated"));
              setAuthView("signin");
            }}
          />
        ) : authView === "forgot-password" ? (
          <ForgotPasswordCard onBack={() => setAuthView("signin")} />
        ) : authView === "resend-confirmation" ? (
          <ResendConfirmationCard onBack={() => setAuthView("signin")} />
        ) : (
          <Tabs value={authView} onValueChange={(val) => setAuthView(val as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <SignInCard
                destination={destination}
                onForgotPassword={() => setAuthView("forgot-password")}
                onResendConfirmation={() => setAuthView("resend-confirmation")}
              />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpCard
                locale={locale}
                onResendConfirmation={() => setAuthView("resend-confirmation")}
              />
            </TabsContent>
          </Tabs>
        )}
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
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) {
          toast.error(error.message);
          setBusy(false);
          return;
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {t("continueWithGoogle")}
    </Button>
  );
}

function SignInCard({
  destination,
  onForgotPassword,
  onResendConfirmation,
}: {
  destination: string;
  onForgotPassword: () => void;
  onResendConfirmation: () => void;
}) {
  const { t, locale } = useI18n();
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
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-password">{t("password")}</Label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-primary hover:underline"
              >
                {t("forgotPassword")}
              </button>
            </div>
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

        <div className="border-t border-border pt-3 text-center">
          <button
            type="button"
            onClick={onResendConfirmation}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {locale === "ar"
              ? "لم يصلك بريد التفعيل؟ إعادة الإرسال"
              : "Didn't receive confirmation email? Resend"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function SignUpCard({
  locale,
  onResendConfirmation,
}: {
  locale: "ar" | "en";
  onResendConfirmation: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    referralCode: "",
  });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Mail className="size-6" />
          </div>
          <CardTitle className="text-center">{t("checkInbox")}</CardTitle>
          <CardDescription className="text-center">
            {locale === "ar"
              ? `لقد أرسلنا رابط تأكيد الحساب إلى ${form.email}. يُرجى فتح البريد والضغط على الرابط لتفعيل حسابك.`
              : `We sent a confirmation link to ${form.email}. Please click the link to activate your account.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="outline" className="w-full" onClick={onResendConfirmation}>
            {t("resendConfirmation")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">
              {t("brand")}
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

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
                  emailRedirectTo: `${window.location.origin}/auth?confirmed=true`,
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
              setSubmitted(true);
              toast.success(t("checkInbox"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="signup-name">{t("fullName")}</Label>
            <Input
              id="signup-name"
              required
              minLength={2}
              value={form.fullName}
              onChange={update("fullName")}
            />
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

        <div className="border-t border-border pt-3 text-center">
          <button
            type="button"
            onClick={onResendConfirmation}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {locale === "ar"
              ? "هل لديك حساب بالفعل ولم يتم تفعيله؟ إعادة إرسال الرابط"
              : "Already created an account? Resend confirmation"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function ForgotPasswordCard({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          {t("forgotPassword")}
        </CardTitle>
        <CardDescription>{t("forgotPasswordDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <div className="space-y-4">
            <Alert className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle>{t("save")}</AlertTitle>
              <AlertDescription>{t("authGenericNotice")}</AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={onBack}>
              {t("backToSignIn")}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                // Enumeration safe: always returns generic success feedback
                await supabase.auth.resetPasswordForEmail(email.trim(), {
                  redirectTo: `${window.location.origin}/auth?mode=reset-password`,
                });
                setSent(true);
                toast.success(t("authGenericNotice"));
              } catch (err: unknown) {
                // Still show generic message to avoid leaking account status
                setSent(true);
                toast.success(t("authGenericNotice"));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{t("email")}</Label>
              <Input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("sendResetLink")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onBack}
            >
              {t("backToSignIn")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ResendConfirmationCard({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5 text-primary" />
          {t("resendConfirmation")}
        </CardTitle>
        <CardDescription>{t("resendDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <div className="space-y-4">
            <Alert className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle>{t("save")}</AlertTitle>
              <AlertDescription>{t("resendNotice")}</AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={onBack}>
              {t("backToSignIn")}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                // Enumeration safe: always returns generic message
                await supabase.auth.resend({
                  type: "signup",
                  email: email.trim(),
                  options: {
                    emailRedirectTo: `${window.location.origin}/auth?confirmed=true`,
                  },
                });
                setSent(true);
                toast.success(t("resendNotice"));
              } catch (err: unknown) {
                setSent(true);
                toast.success(t("resendNotice"));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="resend-email">{t("email")}</Label>
              <Input
                id="resend-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("sendConfirmationLink")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onBack}
            >
              {t("backToSignIn")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ResetPasswordCard({ onSuccess }: { onSuccess: () => void }) {
  const { t, locale } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-primary" />
          {t("resetPassword")}
        </CardTitle>
        <CardDescription>
          {locale === "ar"
            ? "أدخل كلمة المرور الجديدة لحسابك (على الأقل 8 أحرف)."
            : "Enter a new password for your account (minimum 8 characters)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (password !== confirmPassword) {
              toast.error(t("passwordMismatch"));
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({
                password,
              });
              if (error) {
                toast.error(error.message);
                return;
              }
              // Sign out so they can log in with new password cleanly
              await supabase.auth.signOut();
              toast.success(t("passwordUpdated"));
              onSuccess();
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("updatePassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
