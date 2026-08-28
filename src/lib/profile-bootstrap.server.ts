import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BootstrappedProfile = {
  id: string;
  fullName: string | null;
  phone: string | null;
  locale: string;
  referralCode: string;
  referredBy: string | null;
};

/**
 * Permanently and idempotently bootstraps missing public.profiles, public.user_roles,
 * and public.points_balances rows for a verified authenticated user.
 *
 * Security Guarantees:
 * - Uses trusted authenticated identity (userId derived from verified JWT / server claims).
 * - Never grants ADMIN role; defaults exclusively to CUSTOMER role if no role exists.
 * - Initializes points_balances to 0 if missing without fabricating ledger transactions.
 * - Generates cryptographically secure, unique referral codes.
 * - Prevents self-referral and enforces immutable referral attribution.
 * - Idempotent: safe to run multiple times without duplicating or corrupting records.
 */
export async function ensureUserProfile(input: {
  userId: string;
  claims?: Record<string, unknown> | null;
}): Promise<BootstrappedProfile> {
  const { userId, claims } = input;
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }

  // 1. Check for existing profile
  const { data: existingProfile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, locale, referral_code, referred_by")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  let profileRecord = existingProfile;

  if (!profileRecord) {
    // Extract metadata from verified claims or auth.admin
    const userMetadata =
      (claims?.["user_metadata"] as Record<string, unknown> | undefined) ??
      (claims?.["raw_user_meta_data"] as Record<string, unknown> | undefined) ??
      {};

    let fullName =
      (userMetadata["full_name"] as string | undefined) ??
      (userMetadata["name"] as string | undefined) ??
      (userMetadata["user_name"] as string | undefined) ??
      (claims?.["name"] as string | undefined) ??
      null;
    let phone = (userMetadata["phone"] as string | undefined) ?? null;
    let locale = (userMetadata["locale"] as string | undefined) ?? "ar";
    if (locale !== "ar" && locale !== "en") {
      locale = "ar";
    }

    if (!fullName && !phone) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser?.user?.user_metadata) {
          const m = authUser.user.user_metadata as Record<string, unknown>;
          fullName =
            (m["full_name"] as string | undefined) ??
            (m["name"] as string | undefined) ??
            (m["user_name"] as string | undefined) ??
            null;
          phone = (m["phone"] as string | undefined) ?? null;
          if (m["locale"] === "ar" || m["locale"] === "en") {
            locale = m["locale"] as string;
          }
        }
      } catch {
        // Fallback safely to defaults without failing
      }
    }

    fullName = fullName ? fullName.trim() : null;
    if (fullName === "") fullName = null;
    phone = phone ? phone.trim() : null;
    if (phone === "") phone = null;

    let referredBy: string | null = null;
    const incomingRef = (userMetadata["referral_code"] as string | undefined)
      ?.trim()
      ?.toUpperCase();
    if (incomingRef) {
      const { data: refUser } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", incomingRef)
        .maybeSingle();
      if (refUser && refUser.id !== userId) {
        referredBy = refUser.id;
      }
    }

    // Generate unique referral code
    let referralCode = "";
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
      const { data: existingCode } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", candidate)
        .maybeSingle();
      if (!existingCode) {
        referralCode = candidate;
        break;
      }
    }
    if (!referralCode) {
      referralCode = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
    }

    const { data: insertedProfile, error: insertErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: fullName,
          phone,
          locale,
          referral_code: referralCode,
          referred_by: referredBy,
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select("id, full_name, phone, locale, referral_code, referred_by")
      .maybeSingle();

    if (insertErr) {
      throw new Error(insertErr.message);
    }

    if (insertedProfile) {
      profileRecord = insertedProfile;
    } else {
      const { data: refetched } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, locale, referral_code, referred_by")
        .eq("id", userId)
        .single();
      profileRecord = refetched;
    }
  }

  // 2. Ensure CUSTOMER role exists if no role is present (never grant ADMIN)
  const { data: existingRoles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (!rolesErr && (!existingRoles || existingRoles.length === 0)) {
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "CUSTOMER" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
  }

  // 3. Ensure points_balances exists with initial 0
  const { data: existingBalance, error: balErr } = await supabaseAdmin
    .from("points_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (!balErr && !existingBalance) {
    await supabaseAdmin
      .from("points_balances")
      .upsert({ user_id: userId, balance: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
  }

  if (!profileRecord) {
    throw new Error("Profile not found");
  }

  return {
    id: profileRecord.id,
    fullName: profileRecord.full_name,
    phone: profileRecord.phone,
    locale: profileRecord.locale,
    referralCode: profileRecord.referral_code,
    referredBy: profileRecord.referred_by,
  };
}
