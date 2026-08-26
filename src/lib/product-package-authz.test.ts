/**
 * VEN+ Work Item 5 — live download-package gate.
 *
 * Real database, real sessions, real RLS: the archive an admin gets is built
 * from persisted rows, is a valid ZIP with the contracted entries, carries no
 * credentials, and a non-admin caller cannot reach a hidden product's data.
 * Skipped when server credentials are absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unzipSync, strFromU8 } from "fflate";
import { buildProductPackage } from "@/lib/product-package.server";
import { ProductPackageError } from "@/lib/product-package";

const URL_ = process.env["SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
const enabled = Boolean(URL_ && SERVICE_KEY && PUBLISHABLE_KEY);
const ORIGIN = "http://localhost:8080";

function anonClient(): SupabaseClient {
  return createClient(URL_!, PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerClient(token: string): SupabaseClient {
  return createClient(URL_!, PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

describe.skipIf(!enabled)("Work Item 5 — product download package (live)", () => {
  const service = enabled
    ? createClient(URL_!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    : (null as unknown as SupabaseClient);

  const stamp = Date.now();
  const created: { users: string[]; products: string[] } = { users: [], products: [] };
  let adminClient: SupabaseClient;
  let customerClient: SupabaseClient;
  let productId = "";

  async function makeUser(label: string, role: "ADMIN" | "CUSTOMER") {
    const email = `wi5.${label}.${stamp}@example.com`;
    const password = `Wi5-${label}-${stamp}!`;
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
    return bearerClient(signIn.data.session.access_token);
  }

  beforeAll(async () => {
    adminClient = await makeUser("admin", "ADMIN");
    customerClient = await makeUser("customer", "CUSTOMER");

    const product = await service
      .from("products")
      .insert({
        slug: `wi5-pack-${stamp}`,
        name_en: "WI5 package product",
        name_ar: "منتج حزمة الاختبار",
        description_en: "English description",
        description_ar: "وصف عربي",
        cash_price: 199.5,
        points_enabled: true,
        default_points_price: 800,
        delivery_points_reward: 10,
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
        sku: `WI5-${stamp}`,
        name_en: "Standard",
        name_ar: "قياسي",
        cash_price: 199.5,
        points_price: 800,
        stock: 7,
        is_active: true,
      })
      .select("id")
      .single();
    if (variant.error) throw variant.error;

    const media = await service.from("product_images").insert([
      {
        product_id: productId,
        variant_id: variant.data.id,
        url: "/products/scrunchie-black.jpg",
        alt_en: "Black scrunchie",
        alt_ar: "توكة سوداء",
        sort_order: 0,
        is_primary: true,
      },
      {
        product_id: productId,
        url: "/products/definitely-missing.jpg",
        alt_en: "Missing",
        alt_ar: "غير موجود",
        sort_order: 1,
        is_primary: false,
      },
    ]);
    if (media.error) throw media.error;
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await service.from("product_images").delete().in("product_id", created.products);
    await service.from("product_variants").delete().in("product_id", created.products);
    await service.from("products").delete().in("id", created.products);
    for (const userId of created.users) await service.auth.admin.deleteUser(userId);
  }, 60_000);

  it("produces a valid ZIP named after the SKU with the contracted entries", async () => {
    const result = await buildProductPackage({ supabase: adminClient, productId, origin: ORIGIN });
    expect(result.fileName).toBe(`Product-WI5-${stamp}.zip`);

    const bytes = Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0));
    const entries = unzipSync(bytes);
    const names = Object.keys(entries).sort();
    expect(names).toContain("product.json");
    expect(names).toContain("descriptions.json");
    expect(names).toContain("variants.json");
    expect(names).toContain("manifest.json");
    expect(names.every((name) => !name.includes("..") && !name.startsWith("/"))).toBe(true);

    const product = JSON.parse(strFromU8(entries["product.json"]!));
    expect(product.id).toBe(productId);
    expect(product.pricing.cashPrice).toBe(199.5);

    const variants = JSON.parse(strFromU8(entries["variants.json"]!));
    expect(variants.variants[0].sku).toBe(`WI5-${stamp}`);
    expect(variants.variants[0].stock).toBe(7);

    const descriptions = JSON.parse(strFromU8(entries["descriptions.json"]!));
    expect(descriptions.descriptions).toEqual({ en: "English description", ar: "وصف عربي" });
  }, 60_000);

  it("records unavailable images in the manifest instead of failing silently", async () => {
    const result = await buildProductPackage({ supabase: adminClient, productId, origin: ORIGIN });
    const entries = unzipSync(Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0)));
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]!));
    expect(manifest.format).toBe("ven-plus-product-package/1");
    const missingUrls = manifest.missing.map((item: { url: string }) => item.url);
    expect(missingUrls).toContain("/products/definitely-missing.jpg");
    expect(result.missing.length).toBeGreaterThan(0);
  }, 60_000);

  it("never embeds credentials or secrets in the archive", async () => {
    const result = await buildProductPackage({ supabase: adminClient, productId, origin: ORIGIN });
    const entries = unzipSync(Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0)));
    const text = Object.entries(entries)
      .filter(([name]) => name.endsWith(".json"))
      .map(([, value]) => strFromU8(value))
      .join("\n");
    for (const secret of [SERVICE_KEY!, PUBLISHABLE_KEY!, URL_!]) {
      expect(text.includes(secret)).toBe(false);
    }
    expect(text).not.toMatch(/service_role|apikey|authorization|password/i);
  }, 60_000);

  it("cannot expose a hidden product to a non-admin caller (RLS)", async () => {
    await service.from("products").update({ is_active: false }).eq("id", productId);
    try {
      await expect(
        buildProductPackage({ supabase: customerClient, productId, origin: ORIGIN }),
      ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
      await expect(
        buildProductPackage({ supabase: anonClient(), productId, origin: ORIGIN }),
      ).rejects.toBeInstanceOf(ProductPackageError);
      // The same hidden product is still readable by an admin.
      const admin = await buildProductPackage({ supabase: adminClient, productId, origin: ORIGIN });
      expect(admin.byteLength).toBeGreaterThan(0);
    } finally {
      await service.from("products").update({ is_active: true }).eq("id", productId);
    }
  }, 60_000);

  it("fails predictably for an unknown product id", async () => {
    await expect(
      buildProductPackage({
        supabase: adminClient,
        productId: "00000000-0000-0000-0000-000000000000",
        origin: ORIGIN,
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  }, 60_000);
});
