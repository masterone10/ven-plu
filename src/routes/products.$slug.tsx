import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageX, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getProductBySlugOrId } from "@/lib/catalog.functions";
import { ProductDetailsView } from "@/components/product-details-view";

export const Route = createFileRoute("/products/$slug")({
  head: () => ({
    meta: [
      { title: "VEN+ — Product Details" },
      {
        name: "description",
        content:
          "View product specifications, gallery, variant options, pricing, and media assets on VEN+.",
      },
    ],
  }),
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const { slug } = Route.useParams();
  const { locale } = useI18n();
  const fetchProduct = useServerFn(getProductBySlugOrId);

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product-detail", slug],
    queryFn: () => fetchProduct({ data: { slugOrId: slug } }),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {locale === "ar" ? "جاري تحميل تفاصيل المنتج..." : "Loading product details..."}
            </p>
          </div>
        ) : error || !product ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <PackageX className="size-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">
                {locale === "ar" ? "المنتج غير موجود أو غير متاح" : "Product Not Found"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {locale === "ar"
                  ? "قد يكون هذا المنتج تم نقله أو حذفه من الكتالوج."
                  : "This product may have been moved or removed from our catalog."}
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to="/products">
                <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" />
                {locale === "ar" ? "تصفح كل المنتجات" : "Browse All Products"}
              </Link>
            </Button>
          </div>
        ) : (
          <ProductDetailsView product={product} />
        )}
      </main>
    </div>
  );
}
