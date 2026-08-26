/**
 * VEN+ Work Item 4 — live product mutation security gate.
 *
 * Real database, real sessions, real RLS: an ADMIN can mutate the catalog, a
 * CUSTOMER and an anonymous caller cannot — not through any column, and not by
 * claiming a role in the payload. Skipped when server credentials are absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env["SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
const enabled = Boolean(URL && SERVICE_KEY && PUBLISHABLE_KEY);

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

describe.skipIf(!enabled)("Work Item 4 — admin product mutation security (live RLS)", () => {
  const service = enabled
    ? createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    : (null as unknown as SupabaseClient);

  const stamp = Date.now();
  const created: { users: string[]; products: string[] } = { users: [], products: [] };
  let adminClient: SupabaseClient;
  let customerClient: SupabaseClient;
  let adminId = "";
  let customerId = "";
  let productId = "";
  let variantId = "";

  async function makeUser(label: string, role: "ADMIN" | "CUSTOMER") {
    const email = `wi4.${label}.${stamp}@example.com`;
    const password = `Wi4-${label}-${stamp}!`;
    const user = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (user.error || !user.data.user) throw user.error ?? new Error("no user");
    const userId = user.data.user.id;
    created.users.push(userId);
    if (role === "ADMIN") {
      const granted = await service.from("user_roles").insert({ user_id: userId, role: "ADMIN" });
      if (granted.error) throw granted.error;
    }
    const signIn = await anonClient().auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) throw signIn.error ?? new Error("no session");
    return { userId, client: bearerClient(signIn.data.session.access_token) };
  }

  beforeAll(async () => {
    const admin = await makeUser("admin", "ADMIN");
    adminId = admin.userId;
    adminClient = admin.client;
    const customer = await makeUser("customer", "CUSTOMER");
    customerId = customer.userId;
    customerClient = customer.client;

    const product = await service
      .from("products")
      .insert({
        slug: `wi4-widget-${stamp}`,
        name_en: "WI4 widget",
        name_ar: "منتج اختبار",
        cash_price: 100,
        points_enabled: false,
        delivery_points_reward: 5,
        is_active: true,
      })
      .select("id")
      .single();
    if (product.error) throw product.error;
    productId = product.data.id;
    created.products.push(productId);

    const variant = await service
      .from("product_variants")
      .insert({
        product_id: productId,
        sku: `WI4-${stamp}`,
        name_en: "Standard",
        name_ar: "قياسي",
        cash_price: 100,
        stock: 10,
        is_active: true,
      })
      .select("id")
      .single();
    if (variant.error) throw variant.error;
    variantId = variant.data.id;
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await service.from("product_images").delete().in("product_id", created.products);
    await service.from("product_variants").delete().in("product_id", created.products);
    await service.from("products").delete().in("id", created.products);
    for (const userId of created.users) await service.auth.admin.deleteUser(userId);
  }, 60_000);

  it("grants ADMIN through has_role and denies it to a customer", async () => {
    const asAdmin = await adminClient.rpc("has_role", { _user_id: adminId, _role: "ADMIN" });
    const asCustomer = await customerClient.rpc("has_role", { _user_id: customerId, _role: "ADMIN" });
    expect(asAdmin.data).toBe(true);
    expect(asCustomer.data).toBe(false);
  });

  it("lets an admin update product fields", async () => {
    const updated = await adminClient
      .from("products")
      .update({ cash_price: 125, is_active: true })
      .eq("id", productId)
      .select("id, cash_price")
      .maybeSingle();
    expect(updated.error).toBeNull();
    expect(Number(updated.data?.cash_price)).toBe(125);
  });

  it("blocks a customer from updating a product price", async () => {
    const attempt = await customerClient
      .from("products")
      .update({ cash_price: 1 })
      .eq("id", productId)
      .select("id");
    expect(attempt.data ?? []).toHaveLength(0);
    const check = await service.from("products").select("cash_price").eq("id", productId).single();
    expect(Number(check.data?.cash_price)).toBe(125);
  });

  it("blocks a customer from changing variant stock or points price", async () => {
    const attempt = await customerClient
      .from("product_variants")
      .update({ stock: 9999, points_price: 1 })
      .eq("id", variantId)
      .select("id");
    expect(attempt.data ?? []).toHaveLength(0);
    const check = await service
      .from("product_variants")
      .select("stock, points_price")
      .eq("id", variantId)
      .single();
    expect(check.data?.stock).toBe(10);
    expect(check.data?.points_price).toBeNull();
  });

  it("blocks a customer from inserting a product or media row", async () => {
    const product = await customerClient
      .from("products")
      .insert({ slug: `evil-${stamp}`, name_en: "x", name_ar: "x", cash_price: 1 })
      .select("id");
    expect(product.error).not.toBeNull();

    const media = await customerClient
      .from("product_images")
      .insert({ product_id: productId, url: "/evil.jpg" })
      .select("id");
    expect(media.error).not.toBeNull();
  });

  it("blocks a customer from deleting catalog rows", async () => {
    await customerClient.from("product_variants").delete().eq("id", variantId);
    await customerClient.from("products").delete().eq("id", productId);
    const stillThere = await service.from("products").select("id").eq("id", productId).maybeSingle();
    expect(stillThere.data?.id).toBe(productId);
  });

  it("blocks a customer from self-granting the ADMIN role", async () => {
    const attempt = await customerClient
      .from("user_roles")
      .insert({ user_id: customerId, role: "ADMIN" })
      .select("id");
    expect(attempt.error).not.toBeNull();
    const roles = await service.from("user_roles").select("role").eq("user_id", customerId);
    expect((roles.data ?? []).map((row) => row.role)).not.toContain("ADMIN");
  });

  it("blocks anonymous catalog writes and hides inactive products from anon reads", async () => {
    const anon = anonClient();
    const write = await anon.from("products").update({ cash_price: 1 }).eq("id", productId).select("id");
    expect(write.data ?? []).toHaveLength(0);

    await adminClient.from("products").update({ is_active: false }).eq("id", productId);
    const read = await anon.from("products").select("id").eq("id", productId);
    expect(read.data ?? []).toHaveLength(0);
    await adminClient.from("products").update({ is_active: true }).eq("id", productId);
  });

  it("lets an admin manage variant media rows", async () => {
    const inserted = await adminClient
      .from("product_images")
      .insert({
        product_id: productId,
        variant_id: variantId,
        url: "/products/wi4.jpg",
        alt_en: "WI4",
        alt_ar: "منتج",
        sort_order: 0,
        is_primary: true,
      })
      .select("id, variant_id")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.variant_id).toBe(variantId);

    const removed = await adminClient.from("product_images").delete().eq("id", inserted.data!.id).select("id");
    expect(removed.error).toBeNull();
  });
});
