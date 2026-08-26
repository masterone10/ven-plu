import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Gift, Loader2, Wallet } from "lucide-react";
import { getAccountOverview, updateMyProfile } from "@/lib/account.functions";
import { useI18n } from "@/lib/i18n";
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
      { title: "My VEN+ account — points, referrals, profile" },
      {
        name: "description",
        content:
          "View your VEN+ points balance, points history, referral code, and update your contact details.",
      },
      { property: "og:title", content: "My VEN+ account" },
      {
        property: "og:description",
        content: "Your VEN+ points balance, points history, and referral code.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t, formatPoints, ledgerLabel, locale } = useI18n();
  const fetchOverview = useServerFn(getAccountOverview);

  const { data, isPending, error } = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => fetchOverview(),
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="py-24 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Error"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-accent/40 bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-primary-foreground/70">
                <Wallet className="size-4" />
                {t("pointsBalance")}
              </CardDescription>
              <CardTitle className="text-4xl font-black">
                {formatPoints(data.pointsBalance)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Gift className="size-4" />
                {t("myReferralCode")}
              </CardDescription>
              <CardTitle className="flex items-center gap-2 font-mono text-2xl tracking-widest">
                {data.profile.referralCode}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("myReferralCode")}
                  onClick={async () => {
                    await navigator.clipboard.writeText(data.profile.referralCode);
                    toast.success(t("saved"));
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

        <ProfileCard
          profile={data.profile}
          currentLocale={locale}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t("pointsHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPointsYet")}</p>
            ) : (
              data.ledger.map((entry, index) => (
                <div key={entry.id}>
                  {index > 0 ? <Separator className="mb-3" /> : null}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{ledgerLabel(entry.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}
                      </p>
                    </div>
                    <Badge variant={entry.delta > 0 ? "default" : "secondary"}>
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
  const { t, setLocale } = useI18n();
  const queryClient = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  useEffect(() => {
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone ?? "");
  }, [profile.fullName, profile.phone]);

  const mutation = useMutation({
    mutationFn: () =>
      saveProfile({ data: { fullName, phone, locale: currentLocale } }),
    onSuccess: () => {
      toast.success(t("saved"));
      setLocale(currentLocale);
      void queryClient.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (mutationError: unknown) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Error");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile")}</CardTitle>
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
            <Label htmlFor="account-name">{t("fullName")}</Label>
            <Input
              id="account-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-phone">{t("phone")}</Label>
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
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
