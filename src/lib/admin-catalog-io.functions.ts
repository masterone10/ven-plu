import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AdminProductError, forbidden } from "@/lib/admin-product-rules";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AuthedContext = { supabase: any; userId: string };

async function assertAdmin(context: AuthedContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new AdminProductError("INTERNAL_ERROR");
  if (data !== true) throw forbidden();
}

/** Escapes a CSV cell value */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const exportCatalogCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ csvData: string; fileName: string }> => {
    await assertAdmin(context);

    const [productsRes, variantsRes, categoriesRes, imagesRes] = await Promise.all([
      supabaseAdmin.from("products").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("product_variants").select("*").order("created_at", { ascending: true }),
      supabaseAdmin.from("categories").select("*"),
      supabaseAdmin.from("product_images").select("*").order("sort_order", { ascending: true }),
    ]);

    if (productsRes.error || variantsRes.error || categoriesRes.error) {
      throw new AdminProductError("INTERNAL_ERROR");
    }

    const categoriesById = new Map((categoriesRes.data ?? []).map((c: any) => [c.id, c.slug]));
    const variantsByProduct = new Map<string, any[]>();
    for (const v of variantsRes.data ?? []) {
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    }

    const imagesByProduct = new Map<string, string[]>();
    for (const img of imagesRes.data ?? []) {
      const list = imagesByProduct.get(img.product_id) ?? [];
      list.push(img.url);
      imagesByProduct.set(img.product_id, list);
    }

    const headers = [
      "product_slug",
      "category_slug",
      "name_en",
      "name_ar",
      "description_en",
      "description_ar",
      "cash_price",
      "points_enabled",
      "default_points_price",
      "delivery_points_reward",
      "product_is_active",
      "variant_sku",
      "variant_name_en",
      "variant_name_ar",
      "variant_cash_price",
      "variant_points_price",
      "variant_stock",
      "variant_is_active",
      "image_urls",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of productsRes.data ?? []) {
      const variants = variantsByProduct.get(p.id) ?? [];
      const categorySlug = p.category_id ? (categoriesById.get(p.category_id) ?? "") : "";
      const imageUrls = (imagesByProduct.get(p.id) ?? []).join(";");

      if (variants.length === 0) {
        rows.push(
          [
            escapeCsv(p.slug),
            escapeCsv(categorySlug),
            escapeCsv(p.name_en),
            escapeCsv(p.name_ar),
            escapeCsv(p.description_en),
            escapeCsv(p.description_ar),
            escapeCsv(p.cash_price),
            escapeCsv(p.points_enabled ? "TRUE" : "FALSE"),
            escapeCsv(p.default_points_price),
            escapeCsv(p.delivery_points_reward),
            escapeCsv(p.is_active ? "TRUE" : "FALSE"),
            escapeCsv(`${p.slug.toUpperCase()}-DEF`),
            escapeCsv("Standard"),
            escapeCsv("قياسي"),
            "",
            "",
            escapeCsv(10),
            "TRUE",
            escapeCsv(imageUrls),
          ].join(","),
        );
      } else {
        for (const v of variants) {
          rows.push(
            [
              escapeCsv(p.slug),
              escapeCsv(categorySlug),
              escapeCsv(p.name_en),
              escapeCsv(p.name_ar),
              escapeCsv(p.description_en),
              escapeCsv(p.description_ar),
              escapeCsv(p.cash_price),
              escapeCsv(p.points_enabled ? "TRUE" : "FALSE"),
              escapeCsv(p.default_points_price),
              escapeCsv(p.delivery_points_reward),
              escapeCsv(p.is_active ? "TRUE" : "FALSE"),
              escapeCsv(v.sku),
              escapeCsv(v.name_en),
              escapeCsv(v.name_ar),
              escapeCsv(v.cash_price),
              escapeCsv(v.points_price),
              escapeCsv(v.stock),
              escapeCsv(v.is_active ? "TRUE" : "FALSE"),
              escapeCsv(imageUrls),
            ].join(","),
          );
        }
      }
    }

    // Include UTF-8 BOM for Excel Arabic compatibility
    const csvContent = "\uFEFF" + rows.join("\r\n");
    const dateStr = new Date().toISOString().split("T")[0];

    return {
      csvData: csvContent,
      fileName: `ven_plus_catalog_${dateStr}.csv`,
    };
  });

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

export const importCatalogCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ csvText: z.string().min(10) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);

    const cleanText = data.csvText.replace(/^\uFEFF/, "");
    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length <= 1) {
      throw new Error("CSV file is empty or missing headers.");
    }

    const header = parseCsvLine(lines[0] || "");
    const colMap = new Map<string, number>();
    header.forEach((name, idx) => {
      colMap.set(name.toLowerCase().trim().replace(/['"]/g, ""), idx);
    });

    const getCol = (cols: string[], name: string): string => {
      const idx = colMap.get(name.toLowerCase());
      if (idx === undefined || idx >= cols.length) return "";
      return (cols[idx] || "").replace(/^"|"$/g, "").trim();
    };

    // Group rows by product_slug
    const productGroups = new Map<
      string,
      {
        productSlug: string;
        categorySlug: string;
        nameEn: string;
        nameAr: string;
        descEn: string;
        descAr: string;
        cashPrice: number;
        pointsEnabled: boolean;
        defaultPointsPrice: number | null;
        deliveryPointsReward: number;
        isActive: boolean;
        imageUrls: string[];
        variants: Array<{
          sku: string;
          nameEn: string;
          nameAr: string;
          cashPrice: number | null;
          pointsPrice: number | null;
          stock: number;
          isActive: boolean;
        }>;
      }
    >();

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine || !rawLine.trim()) continue;
      const cols = parseCsvLine(rawLine);

      const slug = getCol(cols, "product_slug") || getCol(cols, "slug");
      if (!slug) continue;

      const normSlug = slug.toLowerCase();
      let group = productGroups.get(normSlug);

      if (!group) {
        const categorySlug = getCol(cols, "category_slug");
        const nameEn = getCol(cols, "name_en") || slug;
        const nameAr = getCol(cols, "name_ar") || nameEn;
        const descEn = getCol(cols, "description_en");
        const descAr = getCol(cols, "description_ar");
        const cashPrice = parseFloat(getCol(cols, "cash_price")) || 0;
        const pointsEnabledStr = getCol(cols, "points_enabled").toUpperCase();
        const pointsEnabled =
          pointsEnabledStr === "TRUE" || pointsEnabledStr === "1" || pointsEnabledStr === "YES";
        const pointsPriceRaw = getCol(cols, "default_points_price");
        const defaultPointsPrice = pointsPriceRaw ? parseInt(pointsPriceRaw, 10) : null;
        const rewardRaw = getCol(cols, "delivery_points_reward");
        const deliveryPointsReward = rewardRaw ? parseInt(rewardRaw, 10) : 0;
        const activeStr = getCol(cols, "product_is_active").toUpperCase();
        const isActive = activeStr !== "FALSE" && activeStr !== "0";
        const imagesRaw = getCol(cols, "image_urls");
        const imageUrls = imagesRaw
          ? imagesRaw
              .split(";")
              .map((u) => u.trim())
              .filter(Boolean)
          : [];

        group = {
          productSlug: normSlug,
          categorySlug: categorySlug.toLowerCase(),
          nameEn,
          nameAr,
          descEn,
          descAr,
          cashPrice,
          pointsEnabled,
          defaultPointsPrice,
          deliveryPointsReward,
          isActive,
          imageUrls,
          variants: [],
        };
        productGroups.set(normSlug, group);
      }

      // Add variant
      const sku = (
        getCol(cols, "variant_sku") ||
        getCol(cols, "sku") ||
        `${normSlug.toUpperCase()}-VAR-${group.variants.length + 1}`
      ).toUpperCase();
      const varNameEn = getCol(cols, "variant_name_en") || "Standard";
      const varNameAr = getCol(cols, "variant_name_ar") || "قياسي";
      const varCashPriceRaw = getCol(cols, "variant_cash_price");
      const varCashPrice = varCashPriceRaw ? parseFloat(varCashPriceRaw) : null;
      const varPointsPriceRaw = getCol(cols, "variant_points_price");
      const varPointsPrice = varPointsPriceRaw ? parseInt(varPointsPriceRaw, 10) : null;
      const varStockRaw = getCol(cols, "variant_stock");
      const varStock = varStockRaw ? parseInt(varStockRaw, 10) : 10;
      const varActiveStr = getCol(cols, "variant_is_active").toUpperCase();
      const varIsActive = varActiveStr !== "FALSE" && varActiveStr !== "0";

      // Prevent duplicate SKUs in same product
      if (!group.variants.some((v) => v.sku === sku)) {
        group.variants.push({
          sku,
          nameEn: varNameEn,
          nameAr: varNameAr,
          cashPrice: varCashPrice,
          pointsPrice: varPointsPrice,
          stock: isNaN(varStock) ? 10 : varStock,
          isActive: varIsActive,
        });
      }
    }

    if (productGroups.size === 0) {
      throw new Error("No valid product records found in CSV.");
    }

    // Fetch existing categories
    const { data: existingCategories } = await supabaseAdmin.from("categories").select("id, slug");
    const categoryMap = new Map(
      (existingCategories ?? []).map((c: any) => [c.slug.toLowerCase(), c.id]),
    );

    let importedCount = 0;
    let variantsCount = 0;

    for (const group of productGroups.values()) {
      let categoryId: string | null = null;
      if (group.categorySlug) {
        categoryId = categoryMap.get(group.categorySlug) ?? null;
        if (!categoryId) {
          // Auto-create category if missing
          const { data: newCat } = await supabaseAdmin
            .from("categories")
            .insert({
              slug: group.categorySlug,
              name_en: group.categorySlug.charAt(0).toUpperCase() + group.categorySlug.slice(1),
              name_ar: group.categorySlug,
              sort_order: 10,
              is_active: true,
            })
            .select("id, slug")
            .single();
          if (newCat) {
            categoryId = newCat.id;
            categoryMap.set(newCat.slug.toLowerCase(), newCat.id);
          }
        }
      }

      // Upsert product
      const { data: prodData, error: prodErr } = await supabaseAdmin
        .from("products")
        .upsert(
          {
            slug: group.productSlug,
            category_id: categoryId,
            name_en: group.nameEn,
            name_ar: group.nameAr,
            description_en: group.descEn || null,
            description_ar: group.descAr || null,
            cash_price: group.cashPrice,
            points_enabled: group.pointsEnabled,
            default_points_price: group.pointsEnabled ? group.defaultPointsPrice : null,
            delivery_points_reward: group.deliveryPointsReward,
            is_active: group.isActive,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single();

      if (prodErr || !prodData) continue;
      importedCount++;

      // If variants are empty, create a default standard variant
      const variantsToUpsert =
        group.variants.length > 0
          ? group.variants
          : [
              {
                sku: `${group.productSlug.toUpperCase()}-STD`,
                nameEn: "Standard",
                nameAr: "قياسي",
                cashPrice: null,
                pointsPrice: null,
                stock: 10,
                isActive: true,
              },
            ];

      for (const v of variantsToUpsert) {
        await supabaseAdmin.from("product_variants").upsert(
          {
            product_id: prodData.id,
            sku: v.sku,
            name_en: v.nameEn,
            name_ar: v.nameAr,
            cash_price: v.cashPrice,
            points_price: group.pointsEnabled ? v.pointsPrice : null,
            stock: v.stock,
            is_active: v.isActive,
          },
          { onConflict: "sku" },
        );
        variantsCount++;
      }

      // Handle images if any
      if (group.imageUrls.length > 0) {
        await supabaseAdmin.from("product_images").delete().eq("product_id", prodData.id);
        for (let idx = 0; idx < group.imageUrls.length; idx++) {
          const imgUrl = group.imageUrls[idx];
          if (imgUrl) {
            await supabaseAdmin.from("product_images").insert({
              product_id: prodData.id,
              url: imgUrl,
              alt_en: group.nameEn,
              alt_ar: group.nameAr,
              sort_order: idx,
              is_primary: idx === 0,
            });
          }
        }
      }
    }

    return {
      success: true,
      importedProducts: importedCount,
      importedVariants: variantsCount,
    };
  });
