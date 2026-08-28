import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Coins,
  Download,
  Edit2,
  FileArchive,
  FileSpreadsheet,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  Power,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
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
import { downloadProductPackage } from "@/lib/product-package.functions";
import { getAdminDashboardMetrics } from "@/lib/admin-operations.functions";
import { AdminShippingSettings } from "@/components/admin-shipping-settings";
import { AdminCategoriesTab } from "@/components/admin-categories-tab";
import { AdminInventoryTab } from "@/components/admin-inventory-tab";
import { AdminOrdersTab } from "@/components/admin-orders-tab";
import { AdminExcelTab } from "@/components/admin-excel-tab";
import { AdminImageUploader } from "@/components/admin-image-uploader";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "لوحة تحكم المشرف — VEN+ Admin" },
      {
        name: "description",
        content: "إدارة المنتجات، المتغيرات، الصور، التصنيفات، المخزون، وطلبات العملاء.",
      },
    ],
  }),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const { locale, formatEGP, formatPoints } = useI18n();
  const queryClient = useQueryClient();

  const fetchList = useServerFn(listAdminProducts);
  const fetchSingle = useServerFn(getAdminProduct);
  const saveProductFn = useServerFn(saveAdminProduct);
  const setActiveFn = useServerFn(setAdminProductActive);
  const downloadPkgFn = useServerFn(downloadProductPackage);
  const fetchMetricsFn = useServerFn(getAdminDashboardMetrics);

  const { data, isPending } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => fetchList(),
  });

  const { data: metrics } = useQuery({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: () => fetchMetricsFn(),
  });

  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "ALL" && p.categoryId !== selectedCategory) return false;
      return matchesSearch(p, searchTerm);
    });
  }, [products, searchTerm, selectedCategory]);

  const handleDownloadZip = async (productId: string, productName: string) => {
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
        locale === "ar"
          ? `تم تحميل حزمة الوسائط لـ ${productName}`
          : `Media package downloaded for ${productName}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to download media package");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleProductActive = async (productId: string, current: boolean) => {
    try {
      await setActiveFn({ data: { productId, isActive: !current } });
      toast.success(locale === "ar" ? "تم تحديث حالة نشر المنتج" : "Product status updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-payload"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update product status");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 space-y-6">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {locale === "ar" ? "لوحة تحكم الإدارة" : "Admin Workspace"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "ar"
                ? "إدارة المنتجات، الصور والوسائط، التصنيفات، المخزون، وطلبات العملاء."
                : "Manage products, media assets, categories, inventory, and customer orders."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreating(true)} className="gap-1.5 rounded-xl font-bold">
              <Plus className="size-4" />
              {locale === "ar" ? "إضافة منتج جديد" : "New Product"}
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 rounded-2xl bg-muted/50">
            <TabsTrigger value="dashboard" className="rounded-xl py-2 gap-1.5 text-xs font-bold">
              <LayoutDashboard className="size-4" />
              <span>{locale === "ar" ? "الرئيسية" : "Dashboard"}</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-xl py-2 gap-1.5 text-xs font-bold">
              <Package className="size-4" />
              <span>{locale === "ar" ? "المنتجات" : "Products"}</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-xl py-2 gap-1.5 text-xs font-bold">
              <FolderTree className="size-4" />
              <span>{locale === "ar" ? "التصنيفات" : "Categories"}</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-xl py-2 gap-1.5 text-xs font-bold">
              <Boxes className="size-4" />
              <span>{locale === "ar" ? "المخزون" : "Inventory"}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-xl py-2 gap-1.5 text-xs font-bold">
              <ShoppingBag className="size-4" />
              <span>{locale === "ar" ? "الطلبات" : "Orders"}</span>
            </TabsTrigger>
            <TabsTrigger value="shipping" className="rounded-xl py-2 gap-1.5 text-xs font-bold">
              <Truck className="size-4" />
              <span>{locale === "ar" ? "الشحن" : "Shipping"}</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DASHBOARD METRICS */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-border/80 bg-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {locale === "ar" ? "إجمالي المنتجات" : "Total Products"}
                    </span>
                    <span className="text-2xl font-black">{metrics?.totalProducts ?? 0}</span>
                  </div>
                  <Package className="size-8 text-primary opacity-80" />
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/80 bg-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {locale === "ar" ? "الطلبات قيد المتابعة" : "Pending Orders"}
                    </span>
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {metrics?.pendingOrders ?? 0}
                    </span>
                  </div>
                  <ShoppingBag className="size-8 text-amber-500 opacity-80" />
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/80 bg-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {locale === "ar" ? "تنبيهات انخفاض المخزون" : "Low Stock Alerts"}
                    </span>
                    <span className="text-2xl font-black text-destructive">
                      {metrics?.lowStockCount ?? 0}
                    </span>
                  </div>
                  <AlertTriangle className="size-8 text-destructive opacity-80" />
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/80 bg-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {locale === "ar" ? "إجمالي الطلبات المسلمة" : "Delivered Orders"}
                    </span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {metrics?.deliveredOrders ?? 0}
                    </span>
                  </div>
                  <PackageCheck className="size-8 text-emerald-500 opacity-80" />
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-border/80 bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-bold">
                    {locale === "ar" ? "روابط وإجراءات سريعة" : "Quick Shortcuts"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreating(true)}
                    className="justify-start gap-2 h-11 rounded-xl text-xs"
                  >
                    <Plus className="size-4 text-primary" />
                    {locale === "ar" ? "إضافة منتج" : "Add Product"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("categories")}
                    className="justify-start gap-2 h-11 rounded-xl text-xs"
                  >
                    <FolderTree className="size-4 text-accent" />
                    {locale === "ar" ? "إدارة التصنيفات" : "Manage Categories"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("inventory")}
                    className="justify-start gap-2 h-11 rounded-xl text-xs"
                  >
                    <Boxes className="size-4 text-amber-500" />
                    {locale === "ar" ? "تعديل المخزون" : "Adjust Inventory"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("orders")}
                    className="justify-start gap-2 h-11 rounded-xl text-xs"
                  >
                    <ShoppingBag className="size-4 text-emerald-500" />
                    {locale === "ar" ? "سجل الطلبات" : "View Orders"}
                  </Button>
                </CardContent>
              </Card>

              {/* Excel Import / Export module */}
              <AdminExcelTab />
            </div>
          </TabsContent>

          {/* TAB 2: PRODUCTS TABLE */}
          <TabsContent value="products" className="space-y-6">
            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    locale === "ar"
                      ? "ابحث باسم المنتج أو كود المتغير (SKU)..."
                      : "Search by product name or variant SKU..."
                  }
                  className="ps-10 h-11 rounded-xl text-sm border-border bg-card shadow-sm"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-11 w-full sm:w-56 rounded-xl text-xs">
                  <SelectValue placeholder={locale === "ar" ? "كل التصنيفات" : "All categories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {locale === "ar" ? "جميع التصنيفات" : "All Categories"}
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {locale === "ar" ? c.nameAr : c.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Products List Table */}
            {isPending ? (
              <div className="flex min-h-[30vh] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl">
                <Package className="size-12 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-base font-bold">
                  {locale === "ar" ? "لا توجد منتجات مطابقة" : "No products found"}
                </h3>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
                <table className="w-full text-xs text-start">
                  <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="p-3 text-start">{locale === "ar" ? "المنتج" : "Product"}</th>
                      <th className="p-3 text-start">{locale === "ar" ? "التصنيف" : "Category"}</th>
                      <th className="p-3 text-start">
                        {locale === "ar" ? "السعر الكاش" : "Cash Price"}
                      </th>
                      <th className="p-3 text-start">{locale === "ar" ? "النقاط" : "Points"}</th>
                      <th className="p-3 text-start">
                        {locale === "ar" ? "مكافأة الاستلام" : "Reward"}
                      </th>
                      <th className="p-3 text-start">
                        {locale === "ar" ? "المتغيرات" : "Variants"}
                      </th>
                      <th className="p-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th>
                      <th className="p-3 text-end">{locale === "ar" ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg overflow-hidden bg-muted/40 border border-border shrink-0 flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="size-full object-cover" />
                              ) : (
                                <Package className="size-5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-foreground block">
                                {locale === "ar" ? p.nameAr : p.nameEn}
                              </span>
                              <code className="text-[10px] font-mono text-muted-foreground">
                                {p.slug}
                              </code>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-medium">
                          {p.categoryNameAr ? (
                            <Badge variant="outline" className="text-[10px]">
                              {locale === "ar" ? p.categoryNameAr : p.categoryNameEn}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 font-bold">{formatEGP(p.cashPrice)}</td>
                        <td className="p-3 font-medium">
                          {p.pointsEnabled && p.defaultPointsPrice ? (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Coins className="size-3 text-accent" />
                              {formatPoints(p.defaultPointsPrice)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          +{p.deliveryPointsReward} نقطة
                        </td>
                        <td className="p-3">
                          <span className="font-mono">{p.variants.length}</span>
                        </td>
                        <td className="p-3">
                          <Badge variant={p.isActive ? "default" : "secondary"}>
                            {p.isActive
                              ? locale === "ar"
                                ? "منشور"
                                : "Published"
                              : locale === "ar"
                                ? "معطل"
                                : "Draft"}
                          </Badge>
                        </td>
                        <td className="p-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadZip(p.id, p.nameAr)}
                              disabled={downloadingId === p.id}
                              title={locale === "ar" ? "تحميل حزمة الوسائط" : "Download Media ZIP"}
                              className="size-8 rounded-lg"
                            >
                              {downloadingId === p.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <FileArchive className="size-3.5 text-accent" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleProductActive(p.id, p.isActive)}
                              title={locale === "ar" ? "تبديل حالة النشر" : "Toggle Active"}
                              className={`size-8 rounded-lg ${p.isActive ? "text-amber-600" : "text-emerald-600"}`}
                            >
                              <Power className="size-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingProductId(p.id)}
                              className="size-8 rounded-lg"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: CATEGORIES */}
          <TabsContent value="categories">
            <AdminCategoriesTab />
          </TabsContent>

          {/* TAB 4: INVENTORY */}
          <TabsContent value="inventory">
            <AdminInventoryTab />
          </TabsContent>

          {/* TAB 5: ORDERS */}
          <TabsContent value="orders">
            <AdminOrdersTab />
          </TabsContent>

          {/* TAB 6: SHIPPING SETTINGS */}
          <TabsContent value="shipping">
            <AdminShippingSettings />
          </TabsContent>
        </Tabs>

        {/* Product Editor Modal (For Create & Edit) */}
        {(isCreating || editingProductId) && (
          <ProductEditorDialog
            productId={editingProductId}
            categories={categories}
            open={Boolean(isCreating || editingProductId)}
            onClose={() => {
              setIsCreating(false);
              setEditingProductId(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

/** Product Add/Edit Dialog with drag-and-drop image uploader & variant matrix */
function ProductEditorDialog({
  productId,
  categories,
  open,
  onClose,
}: {
  productId: string | null;
  categories: { id: string; nameAr: string; nameEn?: string | null }[];
  open: boolean;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const fetchSingle = useServerFn(getAdminProduct);
  const saveProductFn = useServerFn(saveAdminProduct);

  const { data: initialData, isLoading } = useQuery({
    queryKey: ["admin-product", productId],
    queryFn: () => (productId ? fetchSingle({ data: { productId } }) : null),
    enabled: Boolean(productId),
  });

  const [form, setForm] = useState<ProductInput>(() => ({
    nameAr: "",
    nameEn: "",
    slug: "",
    descriptionAr: "",
    descriptionEn: "",
    categoryId: null,
    cashPrice: 100,
    pointsEnabled: true,
    defaultPointsPrice: 500,
    deliveryPointsReward: 50,
    isActive: true,
    variants: [
      {
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        nameAr: "الافتراضي",
        nameEn: "Default",
        cashPrice: null,
        pointsPrice: null,
        stock: 10,
        isActive: true,
      },
    ],
    media: [],
  }));

  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sync initial product data when loaded
  if (initialData && !initialized) {
    setForm({
      id: initialData.id,
      nameAr: initialData.nameAr,
      nameEn: initialData.nameEn,
      slug: initialData.slug,
      descriptionAr: initialData.descriptionAr,
      descriptionEn: initialData.descriptionEn,
      categoryId: initialData.categoryId,
      cashPrice: initialData.cashPrice,
      pointsEnabled: initialData.pointsEnabled,
      defaultPointsPrice: initialData.defaultPointsPrice,
      deliveryPointsReward: initialData.deliveryPointsReward,
      isActive: initialData.isActive,
      variants: initialData.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        nameAr: v.nameAr,
        nameEn: v.nameEn,
        cashPrice: v.cashPrice,
        pointsPrice: v.pointsPrice,
        stock: v.stock,
        isActive: v.isActive,
      })),
      media: initialData.media.map((img) => ({
        id: img.id,
        url: img.url,
        altAr: img.altAr,
        altEn: img.altEn,
        variantSku: img.variantSku,
        sortOrder: img.sortOrder,
        isPrimary: img.isPrimary,
      })),
    });
    setInitialized(true);
  }

  const handleAddVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          nameAr: `متغير ${prev.variants.length + 1}`,
          nameEn: `Variant ${prev.variants.length + 1}`,
          cashPrice: null,
          pointsPrice: null,
          stock: 10,
          isActive: true,
        },
      ],
    }));
  };

  const handleRemoveVariant = (index: number) => {
    if (form.variants.length <= 1) {
      toast.error(
        locale === "ar" ? "يجب توفر متغير واحد على الأقل" : "At least one variant required",
      );
      return;
    }
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      toast.error(locale === "ar" ? "يرجى كتابة اسم المنتج بالعربية" : "Arabic name is required");
      return;
    }

    setBusy(true);
    try {
      await saveProductFn({ data: form });
      toast.success(locale === "ar" ? "تم حفظ بيانات المنتج بنجاح" : "Product saved successfully");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-payload"] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {productId
              ? locale === "ar"
                ? "تعديل المنتج"
                : "Edit Product"
              : locale === "ar"
                ? "إضافة منتج جديد"
                : "Create Product"}
          </DialogTitle>
          <DialogDescription>
            {locale === "ar"
              ? "بيانات المنتج، الصور، المتغيرات، الأسعار ونقاط المكافأة"
              : "Product details, media gallery, variants matrix, and points reward"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            {/* General Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name-ar">
                  {locale === "ar" ? "اسم المنتج بالعربية *" : "Arabic Name *"}
                </Label>
                <Input
                  id="prod-name-ar"
                  required
                  value={form.nameAr}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nameAr: e.target.value,
                      slug: prev.id ? prev.slug : e.target.value.trim().replace(/\s+/g, "-"),
                    }))
                  }
                  placeholder="مثال: سيروم الوجه المرطب"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-name-en">
                  {locale === "ar" ? "اسم المنتج بالإنجليزية" : "English Name"}
                </Label>
                <Input
                  id="prod-name-en"
                  value={form.nameEn}
                  onChange={(e) => setForm((prev) => ({ ...prev, nameEn: e.target.value }))}
                  placeholder="e.g. Hydrating Face Serum"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-category">{locale === "ar" ? "التصنيف" : "Category"}</Label>
                <Select
                  value={form.categoryId || "NONE"}
                  onValueChange={(val) =>
                    setForm((prev) => ({ ...prev, categoryId: val === "NONE" ? null : val }))
                  }
                >
                  <SelectTrigger id="prod-category">
                    <SelectValue
                      placeholder={locale === "ar" ? "اختر التصنيف" : "Select Category"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{locale === "ar" ? "بدون تصنيف" : "None"}</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {locale === "ar" ? cat.nameAr : cat.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-slug">
                  {locale === "ar" ? "كود الرابط (Slug) *" : "URL Slug *"}
                </Label>
                <Input
                  id="prod-slug"
                  required
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="hydrating-face-serum"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-desc-ar">
                  {locale === "ar" ? "الوصف بالعربية" : "Arabic Description"}
                </Label>
                <Textarea
                  id="prod-desc-ar"
                  rows={3}
                  value={form.descriptionAr ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, descriptionAr: e.target.value }))}
                  placeholder="وصف مميزات وطريقة استخدام المنتج..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-desc-en">
                  {locale === "ar" ? "الوصف بالإنجليزية" : "English Description"}
                </Label>
                <Textarea
                  id="prod-desc-en"
                  rows={3}
                  value={form.descriptionEn ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, descriptionEn: e.target.value }))}
                  placeholder="Product benefits and directions for use..."
                />
              </div>
            </div>

            {/* Pricing and Rewards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border/80">
              <div className="space-y-1.5">
                <Label htmlFor="base-cash">
                  {locale === "ar" ? "السعر الكاش (ج.م) *" : "Cash Price (EGP) *"}
                </Label>
                <Input
                  id="base-cash"
                  type="number"
                  min="0"
                  required
                  value={form.cashPrice}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, cashPrice: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery-reward">
                  {locale === "ar" ? "مكافأة الاستلام (نقاط) *" : "Delivery Points Reward *"}
                </Label>
                <Input
                  id="delivery-reward"
                  type="number"
                  min="0"
                  required
                  value={form.deliveryPointsReward}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      deliveryPointsReward: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="points-price">
                  {locale === "ar" ? "سعر الشراء بالنقاط" : "Points Price"}
                </Label>
                <Input
                  id="points-price"
                  type="number"
                  min="0"
                  value={form.defaultPointsPrice || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultPointsPrice: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between pt-5">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">
                    {locale === "ar" ? "الشراء بالنقاط" : "Points Redemption"}
                  </Label>
                </div>
                <Switch
                  checked={form.pointsEnabled}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, pointsEnabled: checked }))
                  }
                />
              </div>
            </div>

            {/* Media Upload Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-1.5">
                  <ImageIcon className="size-4 text-primary" />
                  <span>{locale === "ar" ? "معرض الصور والأصول" : "Photo Gallery & Assets"}</span>
                </Label>
              </div>

              <AdminImageUploader
                media={form.media}
                variants={form.variants}
                onChange={(updatedMedia) => setForm((prev) => ({ ...prev, media: updatedMedia }))}
              />
            </div>

            {/* Variants Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-1.5">
                  <Boxes className="size-4 text-accent" />
                  <span>
                    {locale === "ar" ? "المتغيرات والخصائص (Variants)" : "Variants Matrix"}
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariant}
                  className="gap-1 text-xs rounded-xl"
                >
                  <Plus className="size-3.5" />
                  {locale === "ar" ? "إضافة متغير" : "Add Variant"}
                </Button>
              </div>

              <div className="space-y-2">
                {form.variants.map((v, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-6 gap-2 p-3 rounded-xl border border-border/80 bg-card items-center"
                  >
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {locale === "ar" ? "كود SKU" : "SKU"}
                      </span>
                      <Input
                        value={v.sku}
                        required
                        onChange={(e) => {
                          const next = [...form.variants];
                          const target = next[index];
                          if (target) {
                            target.sku = e.target.value;
                            setForm((prev) => ({ ...prev, variants: next }));
                          }
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {locale === "ar" ? "الاسم بالعربية" : "Name (AR)"}
                      </span>
                      <Input
                        value={v.nameAr}
                        required
                        onChange={(e) => {
                          const next = [...form.variants];
                          const target = next[index];
                          if (target) {
                            target.nameAr = e.target.value;
                            setForm((prev) => ({ ...prev, variants: next }));
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {locale === "ar" ? "الاسم بالإنجليزية" : "Name (EN)"}
                      </span>
                      <Input
                        value={v.nameEn}
                        onChange={(e) => {
                          const next = [...form.variants];
                          const target = next[index];
                          if (target) {
                            target.nameEn = e.target.value;
                            setForm((prev) => ({ ...prev, variants: next }));
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {locale === "ar" ? "المخزون" : "Stock"}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        value={v.stock}
                        onChange={(e) => {
                          const next = [...form.variants];
                          const target = next[index];
                          if (target) {
                            target.stock = parseInt(e.target.value) || 0;
                            setForm((prev) => ({ ...prev, variants: next }));
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {locale === "ar" ? "سعر خاص (كاش)" : "Custom Price"}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="افتراضي"
                        value={v.cashPrice ?? ""}
                        onChange={(e) => {
                          const next = [...form.variants];
                          const target = next[index];
                          if (target) {
                            target.cashPrice = e.target.value ? parseFloat(e.target.value) : null;
                            setForm((prev) => ({ ...prev, variants: next }));
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 sm:pt-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={form.variants.length <= 1}
                        onClick={() => handleRemoveVariant(index)}
                        className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={busy} className="gap-1.5 font-bold">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {locale === "ar" ? "حفظ المنتج" : "Save Product"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
