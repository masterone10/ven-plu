import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PointsLedgerEntry = {
  id: string;
  type: string;
  delta: number;
  note: string | null;
  orderId: string | null;
  createdAt: string;
};

export type AccountOverview = {
  profile: {
    id: string;
    fullName: string | null;
    phone: string | null;
    email: string | null;
    locale: string;
    referralCode: string;
    referredBy: string | null;
  };
  pointsBalance: number;
  ledger: PointsLedgerEntry[];
};

/** Reads the signed-in user's profile, authoritative balance, and ledger. */
export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountOverview> => {
    const { supabase, userId, claims } = context;

    const [profileResult, balanceResult, ledgerResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, locale, referral_code, referred_by")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("points_balances").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .from("points_transactions")
        .select("id, type, delta, note, order_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (profileResult.error) throw new Error(profileResult.error.message);
    if (balanceResult.error) throw new Error(balanceResult.error.message);
    if (ledgerResult.error) throw new Error(ledgerResult.error.message);

    const profileRow = profileResult.data;
    let resolvedProfile: {
      id: string;
      fullName: string | null;
      phone: string | null;
      locale: string;
      referralCode: string;
      referredBy: string | null;
    };

    if (profileRow) {
      resolvedProfile = {
        id: profileRow.id,
        fullName: profileRow.full_name,
        phone: profileRow.phone,
        locale: profileRow.locale,
        referralCode: profileRow.referral_code,
        referredBy: profileRow.referred_by,
      };
    } else {
      const { ensureUserProfile } = await import("@/lib/profile-bootstrap.server");
      resolvedProfile = await ensureUserProfile({
        userId,
        claims: claims as Record<string, unknown> | null,
      });
    }

    return {
      profile: {
        id: resolvedProfile.id,
        fullName: resolvedProfile.fullName,
        phone: resolvedProfile.phone,
        email: (claims as { email?: string } | null)?.email ?? null,
        locale: resolvedProfile.locale,
        referralCode: resolvedProfile.referralCode,
        referredBy: resolvedProfile.referredBy,
      },
      pointsBalance: balanceResult.data?.balance ?? 0,
      ledger: (ledgerResult.data ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        delta: row.delta,
        note: row.note,
        orderId: row.order_id,
        createdAt: row.created_at,
      })),
    };
  });

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^01\d{9}$/, "Egyptian mobile numbers must be 11 digits starting with 01")
    .or(z.literal("")),
  locale: z.enum(["ar", "en"]),
});

/** Updates only user-owned, non-privileged profile fields. Role is never writable here. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateProfileSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        phone: data.phone === "" ? null : data.phone,
        locale: data.locale,
      })
      .eq("id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Public referral-code check used at sign-up. Returns only a boolean so the
 * endpoint cannot be used to enumerate customer identities.
 */
export const checkReferralCode = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(16) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ valid: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exists, error } = await supabaseAdmin.rpc("referral_code_exists", {
      _code: data.code.toUpperCase(),
    });
    if (error) return { valid: false };
    return { valid: exists === true };
  });
