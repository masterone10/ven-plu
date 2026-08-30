import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyPointsSummary = {
  balance: number;
};

/**
 * Reads the server/database authoritative points balance for the signed-in user.
 * Reconciles points_balances from the authoritative points_transactions ledger if out of sync.
 */
export const getMyPointsBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPointsSummary> => {
    const { supabase, userId } = context;

    const [balanceResult, ledgerSumResult] = await Promise.all([
      supabase.from("points_balances").select("balance").eq("user_id", userId).maybeSingle(),
      supabase.from("points_transactions").select("delta").eq("user_id", userId),
    ]);

    if (balanceResult.error) throw new Error(balanceResult.error.message);
    if (ledgerSumResult.error) throw new Error(ledgerSumResult.error.message);

    const ledgerEntries = ledgerSumResult.data ?? [];
    let authoritativeBalance = balanceResult.data?.balance;

    // If there are transactions or balance row is missing/divergent, calculate ledger sum
    const computedLedgerBalance = ledgerEntries.reduce(
      (sum, row) => sum + (Number(row.delta) || 0),
      0,
    );

    if (authoritativeBalance === undefined || authoritativeBalance === null) {
      authoritativeBalance = computedLedgerBalance;
      // Auto-heal the points_balances row
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("points_balances")
        .upsert({ user_id: userId, balance: computedLedgerBalance }, { onConflict: "user_id" });
    } else if (ledgerEntries.length > 0 && authoritativeBalance !== computedLedgerBalance) {
      // If table row drifted from ledger accounting truth, reconcile it to the ledger sum
      authoritativeBalance = computedLedgerBalance;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("points_balances")
        .update({ balance: computedLedgerBalance })
        .eq("user_id", userId);
    }

    return {
      balance: Math.max(0, Math.floor(authoritativeBalance)),
    };
  });
