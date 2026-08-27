/**
 * VEN+ Work Item 2 — live ownership / IDOR gate.
 *
 * These tests run against the real database with real Supabase sessions:
 * two customers, real RLS, real order snapshots. They are skipped when
 * server credentials are unavailable (e.g. a plain local checkout).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env["SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
const enabled = Boolean(URL && SERVICE_KEY && PUBLISHABLE_KEY);

const ORDER_COLUMNS = "id, order_number, status, funding_mode, cash_total, points_total, user_id";

type Actor = { userId: string; email: string; client: SupabaseClient; orderId: string };

function anonClient(): SupabaseClient {
  return createClient(URL!, PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerClient(token: string): SupabaseClient {
  return createClient(URL!, PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

describe.skipIf(!enabled)("Work Item 2 — order retrieval ownership (live RLS)", () => {
  const admin = enabled
    ? createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    : (null as unknown as SupabaseClient);

  const stamp = Date.now();
  let alice: Actor;
  let bob: Actor;
  let productId: string;
  let variantId: string;
  let originalPrice: number;

  let schemaReady = true;

  async function makeActor(label: string): Promise<Actor> {
    const email = `wi2.${label}.${stamp}@example.com`;
    const password = `Wi2-${label}-${stamp}!`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `WI2 ${label}` },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("no user");
    const userId = created.data.user.id;

    const signIn = await anonClient().auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) throw signIn.error ?? new Error("no session");

    const order = await admin
      .from("orders")
      .insert({
        user_id: userId,
        status: "PENDING_CONFIRMATION",
        funding_mode: "CASH_ONLY",
        shipping_payment_method: "CASH",
        customer_name: `WI2 ${label}`,
        customer_phone: "01012345678",
        shipping_address: {
          governorate: "Cairo",
          city: "Nasr City",
          street: "1 Test St",
          notes: "",
        },
        shipping_cash_price: 60,
        shipping_points_price: 0,
        cash_total: 1020,
        points_total: 0,
        expected_delivery_duration: "2-5 days",
        idempotency_key: `wi2:${label}:${stamp}`,
        idempotency_fingerprint: `wi2:${label}:${stamp}`,
      })
      .select("id")
      .single();
    if (order.error) throw order.error;

    await admin.from("order_items").insert({
      order_id: order.data.id,
      product_id: productId,
      variant_id: variantId,
      product_name_en: "Snapshot Product",
      product_name_ar: "منتج لحظي",
      variant_name_en: "Snapshot Variant",
      variant_name_ar: "نسخة لحظية",
      sku: "SNAP-1",
      quantity: 2,
      product_payment_method: "CASH",
      unit_cash_price: 480,
      unit_points_price: 0,
      line_cash_total: 960,
      line_points_total: 0,
      delivery_points_reward: 40,
    });

    return {
      userId,
      email,
      client: bearerClient(signIn.data.session.access_token),
      orderId: order.data.id,
    };
  }

  beforeAll(async () => {
    try {
      const probe = await admin
        .from("product_variants")
        .select("id, product_id")
        .limit(1)
        .maybeSingle();
      if (probe.error && probe.error.code === "PGRST205") {
        schemaReady = false;
        return;
      }
      if (!probe.data) {
        schemaReady = false;
        return;
      }
      variantId = probe.data.id;
      productId = probe.data.product_id;

      const product = await admin
        .from("products")
        .select("cash_price")
        .eq("id", productId)
        .single();
      if (product.error) throw product.error;
      originalPrice = Number(product.data.cash_price);

      alice = await makeActor("alice");
      bob = await makeActor("bob");
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "PGRST205") {
        schemaReady = false;
      } else {
        throw err;
      }
    }
  }, 120_000);

  afterAll(async () => {
    if (!enabled || !schemaReady) return;
    try {
      if (productId) {
        await admin.from("products").update({ cash_price: originalPrice }).eq("id", productId);
      }
      for (const actor of [alice, bob]) {
        if (!actor) continue;
        await admin.from("order_items").delete().eq("order_id", actor.orderId);
        await admin.from("orders").delete().eq("id", actor.orderId);
        await admin.auth.admin.deleteUser(actor.userId);
      }
    } catch {
      // Ignore
    }
  }, 120_000);

  it("authenticated customer can retrieve their own order", async () => {
    if (!schemaReady) return;
    const { data, error } = await alice.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", alice.orderId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(alice.orderId);
    expect(data?.funding_mode).toBe("CASH_ONLY");
  });

  it("authenticated customer cannot retrieve another customer's order", async () => {
    if (!schemaReady) return;
    const { data, error } = await alice.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", bob.orderId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("forging the user_id filter does not expose another customer's order", async () => {
    if (!schemaReady) return;
    const { data } = await alice.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("user_id", bob.userId);
    expect(data).toEqual([]);
  });

  it("another customer's order items are not readable", async () => {
    if (!schemaReady) return;
    const { data } = await alice.client
      .from("order_items")
      .select("id, sku, unit_cash_price")
      .eq("order_id", bob.orderId);
    expect(data).toEqual([]);
  });

  it("unauthenticated user cannot retrieve orders", async () => {
    if (!schemaReady) return;
    const guest = anonClient();
    const list = await guest.from("orders").select(ORDER_COLUMNS);
    expect(list.data ?? []).toEqual([]);
    const detail = await guest
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", alice.orderId)
      .maybeSingle();
    expect(detail.data).toBeNull();
    const items = await guest.from("order_items").select("id").eq("order_id", alice.orderId);
    expect(items.data ?? []).toEqual([]);
  });

  it("fabricated order ids leak nothing", async () => {
    if (!schemaReady) return;
    const { data, error } = await alice.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("id", "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("list returns only the authenticated customer's orders", async () => {
    if (!schemaReady) return;
    const { data, error } = await alice.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false });
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.id);
    expect(ids).toContain(alice.orderId);
    expect(ids).not.toContain(bob.orderId);
    expect((data ?? []).every((row) => row.user_id === alice.userId)).toBe(true);
  });

  it("historical order values stay stable when current product data changes", async () => {
    if (!schemaReady) return;
    const before = await alice.client
      .from("order_items")
      .select("product_name_en, sku, unit_cash_price, line_cash_total")
      .eq("order_id", alice.orderId)
      .single();
    expect(before.error).toBeNull();

    const bumped = await admin
      .from("products")
      .update({ cash_price: originalPrice + 777, name_en: "Renamed After Order" })
      .eq("id", productId);
    expect(bumped.error).toBeNull();

    const after = await alice.client
      .from("order_items")
      .select("product_name_en, sku, unit_cash_price, line_cash_total")
      .eq("order_id", alice.orderId)
      .single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
    expect(Number(after.data?.unit_cash_price)).toBe(480);
    expect(after.data?.product_name_en).toBe("Snapshot Product");
  }, 60_000);

  it("customers cannot mutate stored order snapshots", async () => {
    if (!schemaReady) return;
    const update = await alice.client
      .from("orders")
      .update({ cash_total: 1 })
      .eq("id", alice.orderId)
      .select("id");
    expect(update.data ?? []).toEqual([]);
    const check = await alice.client
      .from("orders")
      .select("cash_total")
      .eq("id", alice.orderId)
      .single();
    expect(Number(check.data?.cash_total)).toBe(1020);
  });
});
