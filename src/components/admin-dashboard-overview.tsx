import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Coins,
  DollarSign,
  FolderTree,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import type { AdminProductRow } from "@/lib/admin-product-rules";
import type { AdminOrderRow } from "@/lib/admin-orders-list.functions";

type AdminDashboardOverviewProps = {
  products: AdminProductRow[];
  orders: AdminOrderRow[];
  categoriesCount: number;
  onNavigateTab: (tab: string) => void;
  onOpenCreateProduct: () => void;
  onRefresh: () => void;
};

export function AdminDashboardOverview({
  products,
  orders,
  categoriesCount,
  onNavigateTab,
  onOpenCreateProduct,
  onRefresh,
}: AdminDashboardOverviewProps) {
  const { formatEGP, formatPoints, locale } = useI18n();

  // Metrics computation
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const totalVariants = products.reduce((acc, p) => acc + p.variantCount, 0);
  const totalStock = products.reduce((acc, p) => acc + p.totalStock, 0);

  const lowStockThreshold = 5;
  const lowStockVariants: {
    productName: string;
    variantName: string;
    sku: string;
    stock: number;
  }[] = [];

  for (const p of products) {
    for (const v of p.variants) {
      if (v.isActive && v.stock <= lowStockThreshold) {
        lowStockVariants.push({
          productName: locale === "ar" ? p.nameAr : p.nameEn,
          variantName: locale === "ar" ? v.nameAr : v.nameEn,
          sku: v.sku,
          stock: v.stock,
        });
      }
    }
  }

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) =>
      o.status === "PENDING_CONFIRMATION" || o.status === "CONFIRMED" || o.status === "PROCESSING",
  ).length;
  const deliveredOrders = orders.filter((o) => o.status === "DELIVERED").length;

  const totalCashRevenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((acc, o) => acc + (o.cashTotal || 0), 0);

  const totalPointsRedeemed = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((acc, o) => acc + (o.pointsTotal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {locale === "ar" ? "لوحة التحكم العامة" : "Admin Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? "مؤشرات الأداء العامة، الطلبات المعلقة، وتنبيهات المخزون."
              : "Store overview, pending order queues, and inventory alerts."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 text-xs">
            <RefreshCw className="size-3.5" />
            {locale === "ar" ? "تحديث البيانات" : "Refresh"}
          </Button>
          <Button onClick={onOpenCreateProduct} size="sm" className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            {locale === "ar" ? "إضافة منتج جديد" : "New Product"}
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {locale === "ar" ? "إجمالي المبيعات كاش" : "Cash Revenue"}
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatEGP(totalCashRevenue)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar"
                ? `من إجمالي ${totalOrders} طلب`
                : `From ${totalOrders} total orders`}
            </p>
          </CardContent>
        </Card>

        {/* Points Redeemed */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {locale === "ar" ? "النقاط المستبدلة" : "Points Redeemed"}
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Coins className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {formatPoints(totalPointsRedeemed)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === "ar" ? "مستخدمة في دفع المنتجات والشحن" : "Spent on products & shipping"}
            </p>
          </CardContent>
        </Card>

        {/* Orders Queue */}
        <Card
          className="cursor-pointer border-border transition-colors hover:border-primary/50"
          onClick={() => onNavigateTab("orders")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {locale === "ar" ? "الطلبات المعلقة" : "Pending Orders"}
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingBag className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{pendingOrders}</span>
              <span className="text-xs text-muted-foreground">
                / {totalOrders} {locale === "ar" ? "طلب" : "orders"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {deliveredOrders} {locale === "ar" ? "تم تسليمه بنجاح" : "delivered"}
            </p>
          </CardContent>
        </Card>

        {/* Products & Inventory */}
        <Card
          className="cursor-pointer border-border transition-colors hover:border-primary/50"
          onClick={() => onNavigateTab("products")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {locale === "ar" ? "المنتجات النشطة" : "Active Catalog"}
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{activeProducts}</span>
              <span className="text-xs text-muted-foreground">
                / {totalProducts} {locale === "ar" ? "منتج" : "products"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalStock} {locale === "ar" ? "قطعة في المخزن" : "total stock"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access & Low Stock Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Low Stock Alerts and Recent Orders */}
        <div className="space-y-6 lg:col-span-2">
          {/* Low Stock Alert Box */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <CardTitle className="text-base font-bold">
                    {locale === "ar" ? "تنبيهات المخزون المنخفض" : "Low Stock Inventory Alerts"}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("inventory")}
                  className="gap-1 text-xs text-primary"
                >
                  {locale === "ar" ? "إدارة المخزون" : "Manage Stock"}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                {locale === "ar"
                  ? `المتغيرات التي وصل رصيدها إلى ${lowStockThreshold} قطع أو أقل وتحتاج إلى إعادة توريد.`
                  : `Variants with ${lowStockThreshold} or fewer units remaining.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockVariants.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    {locale === "ar"
                      ? "جميع المتغيرات بحالة مخزون ممتازة ولا توجد نواقص حاليًا."
                      : "All product variants have healthy stock levels."}
                  </span>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {lowStockVariants.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{item.productName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {item.variantName} • SKU: {item.sku}
                        </p>
                      </div>
                      <Badge
                        variant="destructive"
                        className={
                          item.stock === 0 ? "bg-rose-600 text-white" : "bg-amber-600 text-white"
                        }
                      >
                        {item.stock === 0
                          ? locale === "ar"
                            ? "نفد المخزون (0)"
                            : "Out of Stock (0)"
                          : locale === "ar"
                            ? `متبقي: ${item.stock}`
                            : `Stock: ${item.stock}`}
                      </Badge>
                    </div>
                  ))}
                  {lowStockVariants.length > 5 && (
                    <div className="pt-2 text-center">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => onNavigateTab("inventory")}
                        className="text-xs"
                      >
                        {locale === "ar"
                          ? `عرض كافة النواقص (+${lowStockVariants.length - 5})`
                          : `View all low stock (+${lowStockVariants.length - 5})`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders Queue */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="size-4 text-primary" />
                  <CardTitle className="text-base font-bold">
                    {locale === "ar" ? "أحدث الطلبات" : "Recent Orders"}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("orders")}
                  className="gap-1 text-xs text-primary"
                >
                  {locale === "ar" ? "جميع الطلبات" : "All Orders"}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {locale === "ar" ? "لا توجد طلبات بعد" : "No orders found."}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs">#{order.orderNumber}</span>
                          <span className="text-sm font-medium">{order.customerName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.itemCount} {locale === "ar" ? "عناصر" : "items"} •{" "}
                          {new Date(order.createdAt).toLocaleDateString(
                            locale === "ar" ? "ar-EG" : "en-GB",
                          )}
                        </p>
                      </div>
                      <div className="text-end">
                        <div className="font-bold text-sm">{formatEGP(order.cashTotal)}</div>
                        <Badge variant="outline" className="text-[10px]">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Quick Shortcuts & Store Summary */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {locale === "ar" ? "روابط سريعة" : "Quick Actions"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                onClick={onOpenCreateProduct}
              >
                <Plus className="size-4 text-primary" />
                {locale === "ar" ? "إضافة منتج جديد للمتجر" : "Add New Product"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                onClick={() => onNavigateTab("categories")}
              >
                <FolderTree className="size-4 text-accent" />
                {locale === "ar" ? "إدارة تصنيفات المنتجات" : "Manage Categories"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                onClick={() => onNavigateTab("inventory")}
              >
                <Boxes className="size-4 text-emerald-600" />
                {locale === "ar" ? "جرد ومصفوفة المخزون" : "Inventory & Matrix"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                onClick={() => onNavigateTab("shipping")}
              >
                <Truck className="size-4 text-sky-600" />
                {locale === "ar" ? "تعديل مصاريف الشحن" : "Shipping Settings"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                onClick={() => onNavigateTab("io")}
              >
                <TrendingUp className="size-4 text-indigo-600" />
                {locale === "ar" ? "استيراد وتصدير الكتالوج" : "Import & Export"}
              </Button>
            </CardContent>
          </Card>

          {/* Category Summary */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {locale === "ar" ? "هيكلية الكتالوج" : "Catalog Structure"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{locale === "ar" ? "عدد التصنيفات:" : "Categories:"}</span>
                <span className="font-bold text-foreground">{categoriesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{locale === "ar" ? "إجمالي المنتجات:" : "Products:"}</span>
                <span className="font-bold text-foreground">{totalProducts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{locale === "ar" ? "إجمالي المتغيرات:" : "Variants:"}</span>
                <span className="font-bold text-foreground">{totalVariants}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{locale === "ar" ? "إجمالي قطع المخزون:" : "Stock Total:"}</span>
                <span className="font-bold text-foreground">{totalStock}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
