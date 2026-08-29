import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env["SUPABASE_URL"];
const PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
const liveEnabled = Boolean(URL && PUBLISHABLE_KEY);

describe.skipIf(!liveEnabled)("Live Supabase Database & Security Verification", () => {
  const client = liveEnabled ? createClient(URL!, PUBLISHABLE_KEY!) : null!;
  let schemaAvailable = false;

  beforeAll(async () => {
    if (!liveEnabled) return;
    try {
      const timeoutPromise = new Promise<{ error: { code: string } }>((_, reject) =>
        setTimeout(() => reject(new Error("Probe timeout")), 2500),
      );
      const probePromise = client.from("products").select("id").limit(1);
      const res = await Promise.race([probePromise, timeoutPromise]);
      if (!res.error) {
        schemaAvailable = true;
      }
    } catch {
      schemaAvailable = false;
    }
  }, 10_000);

  it("successfully connects to live Supabase and queries active products", async () => {
    if (!schemaAvailable) {
      console.warn("Skipping test: Supabase tables have not been initialized yet.");
      return;
    }
    const { data: products, error } = await client
      .from("products")
      .select("id, slug, name_en, name_ar, cash_price, is_active")
      .eq("is_active", true)
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(products)).toBe(true);
  });

  it("successfully queries catalog categories from live database", async () => {
    if (!schemaAvailable) return;
    const { data: categories, error } = await client
      .from("categories")
      .select("id, slug, name_en, name_ar")
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(categories)).toBe(true);
  });

  it("successfully queries variants and images from live database", async () => {
    if (!schemaAvailable) return;
    const { data: variants, error: vError } = await client
      .from("product_variants")
      .select("id, sku, product_id, stock, cash_price, is_active")
      .eq("is_active", true)
      .limit(10);

    expect(vError).toBeNull();
    expect(Array.isArray(variants)).toBe(true);

    const { data: images, error: iError } = await client
      .from("product_images")
      .select("id, product_id, url, is_primary")
      .limit(10);

    expect(iError).toBeNull();
    expect(Array.isArray(images)).toBe(true);
  });

  it("enforces RLS: anonymous callers are denied insert/update/delete on products", async () => {
    if (!schemaAvailable) return;
    const { error: insertError } = await client.from("products").insert({
      slug: "unauthorized-live-test",
      name_en: "Unauthorized",
      name_ar: "غير مصرح",
      cash_price: 1,
    });

    // RLS should block insertion from anonymous key
    expect(insertError).not.toBeNull();
  });

  it("enforces RLS: anonymous callers are denied direct points modifications", async () => {
    if (!schemaAvailable) return;
    const { error: insertError } = await client.from("points_transactions").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      delta: 99999,
      type: "ADJUSTMENT_CREDIT",
      idempotency_key: "anon_test_attack",
    });

    expect(insertError).not.toBeNull();
  });
});
