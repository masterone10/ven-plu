import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AdminProductError, forbidden } from "@/lib/admin-product-rules";

export type AdminCategoryWithCount = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
};

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

export const listAdminCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCategoryWithCount[]> => {
    await assertAdmin(context);
    const { supabase } = context;

    const [categoriesResult, productsResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, slug, name_en, name_ar, sort_order, is_active, created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("products").select("id, category_id"),
    ]);

    if (categoriesResult.error) throw new AdminProductError("INTERNAL_ERROR");

    const counts = new Map<string, number>();
    for (const p of productsResult.data ?? []) {
      if (p.category_id) {
        counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
      }
    }

    return (categoriesResult.data ?? []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      nameEn: row.name_en,
      nameAr: row.name_ar,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active,
      productCount: counts.get(row.id) ?? 0,
      createdAt: row.created_at,
    }));
  });

const saveCategorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  nameEn: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const saveAdminCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveCategorySchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const payload = {
      slug: data.slug.toLowerCase(),
      name_en: data.nameEn,
      name_ar: data.nameAr,
      sort_order: data.sortOrder,
      is_active: data.isActive,
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", data.id)
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new Error("A category with this slug already exists.");
        }
        throw new AdminProductError("INTERNAL_ERROR");
      }
      return { id: updated.id, created: false };
    } else {
      const { data: created, error } = await supabase
        .from("categories")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new Error("A category with this slug already exists.");
        }
        throw new AdminProductError("INTERNAL_ERROR");
      }
      return { id: created.id, created: true };
    }
  });

export const toggleAdminCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ categoryId: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { error } = await supabase
      .from("categories")
      .update({ is_active: data.isActive })
      .eq("id", data.categoryId);

    if (error) throw new AdminProductError("INTERNAL_ERROR");
    return { ok: true };
  });

export const deleteAdminCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ categoryId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabase } = context;

    // Unlink products assigned to this category
    await supabase
      .from("products")
      .update({ category_id: null })
      .eq("category_id", data.categoryId);

    const { error } = await supabase.from("categories").delete().eq("id", data.categoryId);

    if (error) throw new AdminProductError("INTERNAL_ERROR");
    return { ok: true };
  });
