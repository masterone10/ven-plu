import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ProductPackageError, type ProductPackageResult } from "@/lib/product-package";

export type ProductPackageResultType = ProductPackageResult;

export const downloadProductPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<ProductPackageResult> => {
    const { supabase, userId } = context;

    // Check if user is admin
    const { data: isAdmin, error: adminErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "ADMIN",
    });

    if (adminErr) throw new ProductPackageError("INTERNAL_ERROR");

    // If not admin, check if product is active
    if (!isAdmin) {
      const { data: prod, error } = await supabase
        .from("products")
        .select("is_active")
        .eq("id", data.productId)
        .maybeSingle();

      if (error) throw new ProductPackageError("INTERNAL_ERROR");
      if (!prod) throw new ProductPackageError("PRODUCT_NOT_FOUND");
      if (!prod.is_active) throw new ProductPackageError("FORBIDDEN");
    }

    const { buildProductPackage } = await import("@/lib/product-package.server");
    const origin = process.env["ORIGIN"] || "http://localhost:3000";

    return await buildProductPackage({
      supabase,
      productId: data.productId,
      origin,
    });
  });
