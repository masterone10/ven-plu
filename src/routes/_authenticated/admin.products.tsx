import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  matchesSearch,
  type AdminProductRow,
  type MediaInput,
  type ProductInput,
  type VariantInput,
} from "@/lib/admin-product-rules";
import {
  getAdminProduct,
  listAdminProducts,
  saveAdminProduct,
  setAdminProductActive,
} from "@/lib/admin-products.functions";
import { listAllAdminOrders } from "@/lib/admin-orders-list.functions";
import { downloadProductPackage } from "@/lib/product-package.functions";
import { AdminDashboardOverview } from "@/components/admin-dashboard-overview";
import { AdminInventoryView } from "@/components/admin-inventory-view";
import { AdminShippingSettings } from "@/components/admin-shipping-settings";
import { AdminCategoriesView } from "@/components/admin-categories-view";
import { AdminOrdersView } from "@/components/admin-orders-view";
import { AdminCatalogIO } from "@/components/admin-catalog-io";
import { AdminImageUploader } from "@/components/admin-image-uploader";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "VEN+ Admin — Product Management" },
      {
        name: "description",
        content:
          "Operational VEN+ catalog workspace: product information, media, variants, cash and points prices, stock and publication state.",
      },
    ],
  }),
  component: AdminProductsPage,
});

type AdminTab =
  "dashboard" | "products" | "categories" | "inventory" | "orders" | "shipping" | "io";

function AdminProductsPage() {
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const fetchList = useServerFn(listAdminProducts);
  const fetchOrdersFn = useServerFn(listAllAdminOrders);
  const saveProductFn = useServerFn(saveAdminProduct);
  const setActiveFn = useServerFn(setAdminProductActive);
  const downloadPkgFn = useServerFn(downloadProductPackage);

  const {
    data,
    isPending,
    error,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => fetchList(),
  });

  const { data: ordersData, refetch: refetchOrders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => fetchOrdersFn(),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData?.orders]);

  // Low stock counter for badges
  const lowStockCount = useMemo(() => {
    let count = 0;
    for (const p of products) {
      for (const v of p.variants) {
        if (v.isActive && v.stock <= 5) count++;
      }
    }
    return count;
  }, [products]);

  // Pending orders counter for badge
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === "PENDING_CONFIRMATION" ||
        o.status === "CONFIRMED" ||
        o.status === "PROCESSING",
    ).length;
  }, [orders]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) {
        return false;
      }
      if (statusFilter === "ACTIVE" && !p.isActive) {
        return false;
      }
      if (statusFilter === "INACTIVE" && p.isActive) {
        return false;
      }
      return matchesSearch(p, searchTerm);
    });
  }, [products, searchTerm, selectedCategory, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const toggleActiveMutation = useMutation({
    mutationFn: (input: { productId: string; isActive: boolean }) => setActiveFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(
        locale === "ar" ? "تم تحديث حالة المنتج بنجاح" : "Product status updated successfully",
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update product status");
    },
  });

  const handleDownloadPackage = async (productId: string, productName: string) => {
    setDownloadingId(productId);
    try {
      const res = await downloadPkgFn({ data: { productId } });
      const byteCharacters = atob(res.contentBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        locale === "ar" ? `تم تحميل حزمة ${productName}` : `Downloaded package for ${productName}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download package");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRefreshAll = () => {
    void refetchProducts();
    void refetchOrders();
    toast.success(locale === "ar" ? "تم تحديث البيانات" : "Data refreshed");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
            <h2 className="text-lg font-bold text-destructive">
              {locale === "ar" ? "خطأ في تحميل لوحة الإدارة" : "Admin Access Error"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Access forbidden or unauthorized"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const navItems = [
    {
      id: "dashboard" as AdminTab,
      labelAr: "لوحة التحكم",
      labelEn: "Dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "products" as AdminTab,
      labelAr: "إدارة المنتجات",
      labelEn: "Products",
      icon: Package,
      badge: products.length > 0 ? String(products.length) : null,
    },
    {
      id: "categories" as AdminTab,
      labelAr: "التصنيفات",
      labelEn: "Categories",
      icon: Layers,
      badge: categories.length > 0 ? String(categories.length) : null,
    },
    {
      id: "inventory" as AdminTab,
      labelAr: "إدارة المخزون",
      labelEn: "Inventory",
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeVariant: lowStockCount > 0 ? ("destructive" as const) : ("secondary" as const),
    },
    {
      id: "orders" as AdminTab,
      labelAr: "إدارة الطلبات",
      labelEn: "Orders",
      icon: ClipboardList,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount}` : null,
      badgeVariant: pendingOrdersCount > 0 ? ("default" as const) : ("secondary" as const),
    },
    {
      id: "shipping" as AdminTab,
      labelAr: "إعدادات الشحن",
      labelEn: "Shipping",
      icon: Truck,
      badge: null,
    },
    {
      id: "io" as AdminTab,
      labelAr: "الاستيراد والتصدير",
      labelEn: "Catalog I/O",
      icon: FileSpreadsheet,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* Right Sidebar (Fixed in RTL desktop layout) */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="sticky top-20 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {locale === "ar" ? "نظام إدارة المتجر" : "Store Management"}
                </span>
                <h2 className="text-lg font-black text-foreground">VEN+ Admin</h2>
              </div>
              <Badge variant="outline" className="text-[10px] text-primary">
                v2.0
              </Badge>
            </div>

            {/* Navigation List */}
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#0f4c5c] text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`size-4 ${isActive ? "text-white" : "text-muted-foreground"}`}
                      />
                      <span>{locale === "ar" ? item.labelAr : item.labelEn}</span>
                    </div>
                    {item.badge && (
                      <Badge
                        variant={isActive ? "secondary" : item.badgeVariant || "outline"}
                        className={`text-[10px] px-1.5 py-0.5 ${
                          isActive ? "bg-white/20 text-white border-transparent" : ""
                        }`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-border pt-3">
              <Link
                to="/"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="size-3.5" />
                  <span>{locale === "ar" ? "معاينة المتجر العام" : "View Live Store"}</span>
                </div>
                <span>←</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1">
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <AdminDashboardOverview
              products={products}
              orders={orders}
              categoriesCount={categories.length}
              onNavigateTab={(tab) => setActiveTab(tab as AdminTab)}
              onOpenCreateProduct={() => {
                setIsCreating(true);
                setEditingProductId(null);
              }}
              onRefresh={handleRefreshAll}
            />
          )}

          {/* TAB 2: PRODUCTS CATALOG */}
          {activeTab === "products" && (
            <div className="space-y-6">
              {/* Header Actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                    {locale === "ar" ? "كتالوج المنتجات" : "Product Catalog"}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? "إدارة المنتجات، المتغيرات، الأسعار، المخزون، وحزم التحميل."
                      : "Manage catalog products, variants, pricing, stock, and download packages."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminCatalogIO />
                  <Button
                    onClick={() => {
                      setIsCreating(true);
                      setEditingProductId(null);
                    }}
                    className="gap-2 bg-[#e65100] text-white hover:bg-[#c44400]"
                  >
                    <Plus className="size-4" />
                    {locale === "ar" ? "إضافة منتج جديد" : "New Product"}
                  </Button>
                </div>
              </div>

              {/* Filters and Search Bar */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={
                      locale === "ar"
                        ? "بحث بالاسم، الرابط، التصنيف..."
                        : "Search by name, slug, category..."
                    }
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="ps-9"
                  />
                </div>

                <Select
                  value={selectedCategory}
                  onValueChange={(val) => {
                    setSelectedCategory(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={locale === "ar" ? "كل التصنيفات" : "All Categories"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      {locale === "ar" ? "كل التصنيفات" : "All Categories"}
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {locale === "ar" ? cat.nameAr : cat.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(val: "ALL" | "ACTIVE" | "INACTIVE") => {
                    setStatusFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={locale === "ar" ? "حالة النشر" : "Status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{locale === "ar" ? "الكل" : "All Status"}</SelectItem>
                    <SelectItem value="ACTIVE">
                      {locale === "ar" ? "المنتجات النشطة" : "Active Only"}
                    </SelectItem>
                    <SelectItem value="INACTIVE">
                      {locale === "ar" ? "المنتجات المعطلة" : "Inactive Only"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products Table */}
              {isPending ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="size-10 text-muted-foreground" />
                    <p className="mt-4 text-base font-semibold">
                      {locale === "ar" ? "لا توجد منتجات مطابقة" : "No products found"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {locale === "ar"
                        ? "جرّب تغيير عبارة البحث أو الفلتر."
                        : "Try adjusting your search or category filter."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm">
                      <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "المنتج" : "Product"}
                          </th>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "التصنيف" : "Category"}
                          </th>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "سعر الكاش" : "Cash Price"}
                          </th>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "النقاط" : "Points"}
                          </th>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "المتغيرات" : "Variants"}
                          </th>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "إجمالي المخزون" : "Total Stock"}
                          </th>
                          <th className="px-4 py-3 text-start">
                            {locale === "ar" ? "الحالة" : "Status"}
                          </th>
                          <th className="px-4 py-3 text-end">
                            {locale === "ar" ? "الإجراءات" : "Actions"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedProducts.map((product) => {
                          const isDownloading = downloadingId === product.id;
                          return (
                            <tr key={product.id} className="transition-colors hover:bg-muted/30">
                              {/* Product info */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted/50">
                                    {product.imageUrl ? (
                                      <img
                                        src={product.imageUrl}
                                        alt={locale === "ar" ? product.nameAr : product.nameEn}
                                        className="size-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex size-full items-center justify-center text-muted-foreground">
                                        <ImageIcon className="size-5" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-foreground">
                                      {locale === "ar" ? product.nameAr : product.nameEn}
                                    </div>
                                    <div className="font-mono text-xs text-muted-foreground">
                                      {product.slug}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Category */}
                              <td className="px-4 py-3 text-muted-foreground">
                                {product.categoryId
                                  ? locale === "ar"
                                    ? product.categoryNameAr
                                    : product.categoryNameEn
                                  : "—"}
                              </td>

                              {/* Cash price */}
                              <td className="px-4 py-3 font-medium">
                                {formatEGP(product.cashPrice)}
                              </td>

                              {/* Points */}
                              <td className="px-4 py-3">
                                {product.pointsEnabled ? (
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {product.pointsPrice
                                      ? formatPoints(product.pointsPrice)
                                      : "Enabled"}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {locale === "ar" ? "معطل" : "Disabled"}
                                  </span>
                                )}
                              </td>

                              {/* Variants count */}
                              <td className="px-4 py-3 text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {product.activeVariantCount}
                                </span>
                                {" / "}
                                <span>{product.variantCount}</span>
                              </td>

                              {/* Total Stock */}
                              <td className="px-4 py-3">
                                <span
                                  className={`font-semibold ${
                                    product.totalStock === 0
                                      ? "text-destructive"
                                      : product.totalStock < 5
                                        ? "text-amber-500 font-bold"
                                        : "text-foreground"
                                  }`}
                                >
                                  {product.totalStock}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={product.isActive}
                                    disabled={toggleActiveMutation.isPending}
                                    onCheckedChange={(checked) => {
                                      toggleActiveMutation.mutate({
                                        productId: product.id,
                                        isActive: checked,
                                      });
                                    }}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {product.isActive
                                      ? locale === "ar"
                                        ? "نشط"
                                        : "Active"
                                      : locale === "ar"
                                        ? "غير نشط"
                                        : "Inactive"}
                                  </span>
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 text-end">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isDownloading}
                                    onClick={() =>
                                      handleDownloadPackage(
                                        product.id,
                                        locale === "ar" ? product.nameAr : product.nameEn,
                                      )
                                    }
                                    title={
                                      locale === "ar"
                                        ? "تحميل حزمة المنتج ZIP"
                                        : "Download product ZIP package"
                                    }
                                  >
                                    {isDownloading ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Download className="size-3.5" />
                                    )}
                                    <span className="sr-only sm:not-sr-only sm:ms-1.5 text-xs">
                                      {locale === "ar" ? "حزمة" : "Package"}
                                    </span>
                                  </Button>

                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setEditingProductId(product.id);
                                      setIsCreating(false);
                                    }}
                                  >
                                    {locale === "ar" ? "تعديل" : "Edit"}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar (10 per page) */}
                  <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      {locale === "ar"
                        ? `عرض ${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(
                            currentPage * itemsPerPage,
                            filteredProducts.length,
                          )} من أصل ${filteredProducts.length} منتج`
                        : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(
                            currentPage * itemsPerPage,
                            filteredProducts.length,
                          )} of ${filteredProducts.length} products`}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-8 gap-1 px-2.5 text-xs"
                      >
                        <ChevronRight className="size-3.5 rtl:rotate-180" />
                        {locale === "ar" ? "السابق" : "Prev"}
                      </Button>
                      <span className="px-2 text-xs font-semibold">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 gap-1 px-2.5 text-xs"
                      >
                        {locale === "ar" ? "التالي" : "Next"}
                        <ChevronLeft className="size-3.5 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CATEGORIES */}
          {activeTab === "categories" && <AdminCategoriesView />}

          {/* TAB 4: INVENTORY */}
          {activeTab === "inventory" && (
            <AdminInventoryView products={products} onRefresh={handleRefreshAll} />
          )}

          {/* TAB 5: ORDERS */}
          {activeTab === "orders" && <AdminOrdersView />}

          {/* TAB 6: SHIPPING SETTINGS */}
          {activeTab === "shipping" && <AdminShippingSettings />}

          {/* TAB 7: CATALOG I/O */}
          {activeTab === "io" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {locale === "ar" ? "استيراد وتصدير الكتالوج" : "Catalog Import & Export"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "تصدير كتالوج المنتجات إلى ملف CSV أو استيراد تحديثات مجمعة."
                    : "Export the full catalog to CSV or bulk import changes."}
                </p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {locale === "ar" ? "أدوات CSV للكتالوج" : "Catalog CSV Operations"}
                  </CardTitle>
                  <CardDescription>
                    {locale === "ar"
                      ? "يمكنك تحميل نسخة كاملة من البيانات أو رفع ملف CSV محدث."
                      : "Download current product data or upload an updated CSV file."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminCatalogIO />
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Product Editor Modal */}
      {(isCreating || editingProductId) && (
        <ProductEditorModal
          productId={editingProductId}
          categories={categories}
          onClose={() => {
            setEditingProductId(null);
            setIsCreating(false);
          }}
          onSaved={() => {
            setEditingProductId(null);
            setIsCreating(false);
            void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            void queryClient.invalidateQueries({ queryKey: ["catalog"] });
          }}
        />
      )}
    </div>
  );
}

function ProductEditorModal({
  productId,
  categories,
  onClose,
  onSaved,
}: {
  productId: string | null;
  categories: { id: string; nameEn: string; nameAr: string; isActive: boolean }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale } = useI18n();
  const fetchSingle = useServerFn(getAdminProduct);
  const saveFn = useServerFn(saveAdminProduct);

  const { data: existingData, isPending } = useQuery({
    queryKey: ["admin-product", productId],
    queryFn: () => (productId ? fetchSingle({ data: { productId } }) : null),
    enabled: Boolean(productId),
  });

  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [cashPrice, setCashPrice] = useState<number>(0);
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [defaultPointsPrice, setDefaultPointsPrice] = useState<number | null>(100);
  const [deliveryPointsReward, setDeliveryPointsReward] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [variants, setVariants] = useState<VariantInput[]>([
    {
      sku: "SKU-01",
      nameEn: "Standard",
      nameAr: "قياسي",
      cashPrice: null,
      pointsPrice: null,
      stock: 10,
      isActive: true,
    },
  ]);

  const [media, setMedia] = useState<MediaInput[]>([]);

  // Prepopulate form when editing
  useMemo(() => {
    if (existingData) {
      setSlug(existingData.slug);
      setCategoryId(existingData.categoryId);
      setNameEn(existingData.nameEn);
      setNameAr(existingData.nameAr);
      setDescriptionEn(existingData.descriptionEn ?? "");
      setDescriptionAr(existingData.descriptionAr ?? "");
      setCashPrice(existingData.cashPrice);
      setPointsEnabled(existingData.pointsEnabled);
      setDefaultPointsPrice(existingData.defaultPointsPrice);
      setDeliveryPointsReward(existingData.deliveryPointsReward ?? 0);
      setIsActive(existingData.isActive);
      setVariants(existingData.variants);
      setMedia(existingData.media);
    }
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProductInput) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success(locale === "ar" ? "تم حفظ المنتج بنجاح" : "Product saved successfully");
      onSaved();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!slug.trim()) {
      toast.error(locale === "ar" ? "الرابط الدائم مطلوب" : "Slug is required");
      return;
    }
    if (!nameEn.trim() || !nameAr.trim()) {
      toast.error(
        locale === "ar"
          ? "اسم المنتج بالعربية والإنجليزية مطلوب"
          : "Product names in English and Arabic are required",
      );
      return;
    }
    if (variants.length === 0) {
      toast.error(
        locale === "ar" ? "يجب إضافة متغير واحد على الأقل" : "At least one variant is required",
      );
      return;
    }

    const payload: ProductInput = {
      ...(productId ? { id: productId } : {}),
      slug: slug.trim().toLowerCase(),
      categoryId: categoryId === "none" || !categoryId ? null : categoryId,
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      descriptionEn: descriptionEn.trim() || null,
      descriptionAr: descriptionAr.trim() || null,
      cashPrice: Number(cashPrice),
      pointsEnabled,
      defaultPointsPrice: pointsEnabled
        ? defaultPointsPrice
          ? Number(defaultPointsPrice)
          : null
        : null,
      deliveryPointsReward: Number(deliveryPointsReward || 0),
      isActive,
      variants: variants.map((v) => ({
        ...v,
        sku: v.sku.trim().toUpperCase(),
        cashPrice: v.cashPrice != null ? Number(v.cashPrice) : null,
        pointsPrice: pointsEnabled && v.pointsPrice != null ? Number(v.pointsPrice) : null,
        stock: Number(v.stock || 0),
      })),
      media: media.map((m, idx) => ({
        ...m,
        sortOrder: idx,
      })),
    };

    saveMutation.mutate(payload);
  };

  const addVariant = () => {
    const nextNum = variants.length + 1;
    setVariants([
      ...variants,
      {
        sku: `${slug.toUpperCase() || "SKU"}-VAR-${nextNum}`,
        nameEn: `Variant ${nextNum}`,
        nameAr: `متغير ${nextNum}`,
        cashPrice: null,
        pointsPrice: null,
        stock: 10,
        isActive: true,
      },
    ]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.error(
        locale === "ar" ? "لا يمكن حذف المتغير الوحيد" : "Cannot remove the only variant",
      );
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const addImage = () => {
    setMedia([
      ...media,
      {
        url: "/products/scrunchie-black.jpg",
        altEn: nameEn || "Product image",
        altAr: nameAr || "صورة المنتج",
        variantSku: null,
        sortOrder: media.length,
        isPrimary: media.length === 0,
      },
    ]);
  };

  const removeImage = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {productId
              ? locale === "ar"
                ? "تعديل المنتج"
                : "Edit Product"
              : locale === "ar"
                ? "إضافة منتج جديد"
                : "New Product"}
          </DialogTitle>
          <DialogDescription>
            {locale === "ar"
              ? "قم بضبط بيانات المنتج، المتغيرات، والصور."
              : "Configure product details, pricing, variants, and gallery media."}
          </DialogDescription>
        </DialogHeader>

        {isPending && productId ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* General Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="slug">{locale === "ar" ? "الرابط الدائم (Slug)" : "Slug"}</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. vitamin-c-serum"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">{locale === "ar" ? "التصنيف" : "Category"}</Label>
                <Select
                  value={categoryId ?? "none"}
                  onValueChange={(val) => setCategoryId(val === "none" ? null : val)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder={locale === "ar" ? "بدون تصنيف" : "No Category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {locale === "ar" ? "بدون تصنيف" : "No Category"}
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {locale === "ar" ? c.nameAr : c.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nameEn">
                  {locale === "ar" ? "الاسم بالإنجليزية" : "English Name"}
                </Label>
                <Input
                  id="nameEn"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Vitamin C Serum"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nameAr">{locale === "ar" ? "الاسم بالعربية" : "Arabic Name"}</Label>
                <Input
                  id="nameAr"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="سيروم فيتامين سي"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="descEn">
                  {locale === "ar" ? "الوصف بالإنجليزية" : "English Description"}
                </Label>
                <Textarea
                  id="descEn"
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="descAr">
                  {locale === "ar" ? "الوصف بالعربية" : "Arabic Description"}
                </Label>
                <Textarea
                  id="descAr"
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Pricing and Points */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-bold text-foreground">
                {locale === "ar" ? "التسعير وإعدادات النقاط" : "Pricing & Points Rules"}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cashPrice">
                    {locale === "ar" ? "السعر كاش (EGP)" : "Cash Price (EGP)"}
                  </Label>
                  <Input
                    id="cashPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashPrice}
                    onChange={(e) => setCashPrice(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pointsEnabled">
                      {locale === "ar" ? "الشراء بالنقاط" : "Points Enabled"}
                    </Label>
                    <Switch
                      id="pointsEnabled"
                      checked={pointsEnabled}
                      onCheckedChange={setPointsEnabled}
                    />
                  </div>
                  {pointsEnabled && (
                    <Input
                      type="number"
                      min="1"
                      placeholder={
                        locale === "ar" ? "سعر النقاط الافتراضي" : "Default points price"
                      }
                      value={defaultPointsPrice ?? ""}
                      onChange={(e) =>
                        setDefaultPointsPrice(e.target.value ? Number(e.target.value) : null)
                      }
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reward">
                    {locale === "ar" ? "مكافأة نقاط التوصيل" : "Delivery Points Reward"}
                  </Label>
                  <Input
                    id="reward"
                    type="number"
                    min="0"
                    value={deliveryPointsReward}
                    onChange={(e) => setDeliveryPointsReward(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="isActive" className="cursor-pointer">
                  {isActive
                    ? locale === "ar"
                      ? "المنتج متاح في المتجر (Active)"
                      : "Product is published (Active)"
                    : locale === "ar"
                      ? "المنتج مخفي (Inactive)"
                      : "Product is hidden (Inactive)"}
                </Label>
              </div>
            </div>

            {/* Variants */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {locale === "ar" ? "المتغيرات (Variants)" : "Variants"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? "رمز SKU فريد، الأسعار الاختيارية الخاصة، والمخزون."
                      : "Unique SKU, optional price overrides, and stock level."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                  className="gap-1"
                >
                  <Plus className="size-3.5" />
                  {locale === "ar" ? "إضافة متغير" : "Add Variant"}
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                {variants.map((variant, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-md border border-border bg-muted/10 p-3 sm:grid-cols-6 sm:items-end"
                  >
                    <div>
                      <Label className="text-xs">{locale === "ar" ? "رمز SKU" : "SKU"}</Label>
                      <Input
                        value={variant.sku}
                        onChange={(e) => {
                          const updated = [...variants];
                          const item = updated[index];
                          if (item) {
                            item.sku = e.target.value;
                            setVariants(updated);
                          }
                        }}
                        className="mt-1 font-mono text-xs"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {locale === "ar" ? "الاسم (EN)" : "Name (EN)"}
                      </Label>
                      <Input
                        value={variant.nameEn}
                        onChange={(e) => {
                          const updated = [...variants];
                          const item = updated[index];
                          if (item) {
                            item.nameEn = e.target.value;
                            setVariants(updated);
                          }
                        }}
                        className="mt-1 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {locale === "ar" ? "الاسم (AR)" : "Name (AR)"}
                      </Label>
                      <Input
                        value={variant.nameAr}
                        onChange={(e) => {
                          const updated = [...variants];
                          const item = updated[index];
                          if (item) {
                            item.nameAr = e.target.value;
                            setVariants(updated);
                          }
                        }}
                        className="mt-1 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{locale === "ar" ? "المخزون" : "Stock"}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={variant.stock}
                        onChange={(e) => {
                          const updated = [...variants];
                          const item = updated[index];
                          if (item) {
                            item.stock = Number(e.target.value);
                            setVariants(updated);
                          }
                        }}
                        className="mt-1 text-xs"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={variant.isActive}
                        onCheckedChange={(val) => {
                          const updated = [...variants];
                          const item = updated[index];
                          if (item) {
                            item.isActive = val;
                            setVariants(updated);
                          }
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {variant.isActive ? "Active" : "Off"}
                      </span>
                    </div>
                    <div className="text-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVariant(index)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Media Gallery with Drag & Drop */}
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-foreground">
                  {locale === "ar" ? "الصور والوسائط" : "Media & Images"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "اسحب وأفلت الصور من جهازك، أو أدخل روابط مباشرة، وعيّن الصورة الرئيسية واربطها بالمتغيرات."
                    : "Drag & drop images, add direct URLs, select the primary cover image, and map to variants."}
                </p>
              </div>

              <AdminImageUploader
                media={media}
                variants={variants}
                productNameEn={nameEn}
                productNameAr={nameAr}
                onChange={setMedia}
              />
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {locale === "ar" ? "حفظ التغييرات" : "Save Product"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
