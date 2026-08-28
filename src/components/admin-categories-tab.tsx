import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Edit2, FolderPlus, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  saveAdminCategory,
  toggleAdminCategoryActive,
  generateCategorySlug,
} from "@/lib/admin-operations.functions";
import { listAdminProducts } from "@/lib/admin-products.functions";

export function AdminCategoriesTab() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const fetchAdminProducts = useServerFn(listAdminProducts);
  const saveCategoryFn = useServerFn(saveAdminCategory);
  const toggleCategoryFn = useServerFn(toggleAdminCategoryActive);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => fetchAdminProducts(),
  });

  const categories = data?.categories ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id?: string;
    nameAr: string;
    nameEn: string;
    slug: string;
    isActive: boolean;
    sortOrder: number;
  } | null>(null);

  const [busy, setBusy] = useState(false);

  const handleOpenCreate = () => {
    setEditingCategory({
      nameAr: "",
      nameEn: "",
      slug: "",
      isActive: true,
      sortOrder: categories.length,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (cat: {
    id: string;
    nameAr: string;
    nameEn?: string | null;
    slug: string;
    isActive: boolean;
    sortOrder?: number;
  }) => {
    setEditingCategory({
      id: cat.id,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn || "",
      slug: cat.slug,
      isActive: cat.isActive,
      sortOrder: cat.sortOrder || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.nameAr.trim()) {
      toast.error(locale === "ar" ? "يرجى كتابة الاسم بالعربية" : "Arabic name is required");
      return;
    }

    setBusy(true);
    try {
      const generatedSlug =
        editingCategory.slug ||
        generateCategorySlug(editingCategory.nameAr, editingCategory.nameEn);

      await saveCategoryFn({
        data: {
          id: editingCategory.id,
          nameAr: editingCategory.nameAr.trim(),
          nameEn: editingCategory.nameEn.trim() || editingCategory.nameAr.trim(),
          slug: generatedSlug,
          isActive: editingCategory.isActive,
          sortOrder: editingCategory.sortOrder,
        },
      });

      toast.success(locale === "ar" ? "تم حفظ التصنيف بنجاح" : "Category saved successfully");
      setDialogOpen(false);
      setEditingCategory(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-payload"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await toggleCategoryFn({ data: { categoryId: id, isActive: !current } });
      toast.success(locale === "ar" ? "تم تحديث حالة التصنيف" : "Category status updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-payload"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update category status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {locale === "ar" ? "إدارة التصنيفات" : "Category Management"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "إنشاء وتعديل تصنيفات الكتالوج مع توليد الـSlug تلقائيًا باللغة العربية والإنجليزية."
              : "Create and update store categories with auto-slug generation."}
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-1.5 rounded-xl">
          <Plus className="size-4" />
          {locale === "ar" ? "إضافة تصنيف جديد" : "New Category"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : categories.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FolderPlus className="size-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold">
              {locale === "ar" ? "لا توجد تصنيفات بعد" : "No categories yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {locale === "ar"
                ? "أضف أول تصنيف لتنظيم منتجات المتجر وتسهيل التصفح على العملاء."
                : "Add your first category to organize products."}
            </p>
            <Button onClick={handleOpenCreate} size="sm" className="mt-4 rounded-xl">
              {locale === "ar" ? "إضافة تصنيف" : "Add Category"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="rounded-2xl border-border/80 bg-card overflow-hidden">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <Badge
                  variant={cat.isActive ? "default" : "secondary"}
                  className="text-xs font-semibold"
                >
                  {cat.isActive
                    ? locale === "ar"
                      ? "نشط"
                      : "Active"
                    : locale === "ar"
                      ? "معطل"
                      : "Inactive"}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(cat)}
                    className="size-8 rounded-lg"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(cat.id, cat.isActive)}
                    className={`size-8 rounded-lg ${cat.isActive ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    <Power className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div>
                  <h3 className="text-base font-bold text-foreground">{cat.nameAr}</h3>
                  <p className="text-xs text-muted-foreground">{cat.nameEn}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                  <span>كود التصنيف (Slug):</span>
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground">
                    {cat.slug}
                  </code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory?.id
                ? locale === "ar"
                  ? "تعديل التصنيف"
                  : "Edit Category"
                : locale === "ar"
                  ? "إضافة تصنيف جديد"
                  : "Create Category"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ar"
                ? "يتم توليد الـSlug تلقائيًا؛ لا يُطلب إدخال رموز معقدة يدوياً."
                : "Slug is auto-generated from Arabic or English name."}
            </DialogDescription>
          </DialogHeader>

          {editingCategory && (
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name-ar">
                  {locale === "ar" ? "الاسم بالعربية *" : "Arabic Name *"}
                </Label>
                <Input
                  id="cat-name-ar"
                  required
                  value={editingCategory.nameAr}
                  onChange={(e) => {
                    const nextAr = e.target.value;
                    setEditingCategory((prev) =>
                      prev
                        ? {
                            ...prev,
                            nameAr: nextAr,
                            slug: prev.id ? prev.slug : generateCategorySlug(nextAr, prev.nameEn),
                          }
                        : null,
                    );
                  }}
                  placeholder="مثال: عناية بالبشرة"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-name-en">
                  {locale === "ar" ? "الاسم بالإنجليزية (اختياري)" : "English Name (Optional)"}
                </Label>
                <Input
                  id="cat-name-en"
                  value={editingCategory.nameEn}
                  onChange={(e) => {
                    const nextEn = e.target.value;
                    setEditingCategory((prev) =>
                      prev
                        ? {
                            ...prev,
                            nameEn: nextEn,
                            slug: prev.id ? prev.slug : generateCategorySlug(prev.nameAr, nextEn),
                          }
                        : null,
                    );
                  }}
                  placeholder="e.g. Skin Care"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-slug">
                  {locale === "ar" ? "الرابط اللطيف (Slug) — يُولَّد تلقائيًا" : "Slug (Auto)"}
                </Label>
                <Input
                  id="cat-slug"
                  value={editingCategory.slug}
                  onChange={(e) =>
                    setEditingCategory((prev) => (prev ? { ...prev, slug: e.target.value } : null))
                  }
                  placeholder="skin-care"
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/80 p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">
                    {locale === "ar" ? "حالة النشر" : "Active Status"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? "يظهر في شريط التصنيفات للعملاء"
                      : "Visible in public catalog"}
                  </p>
                </div>
                <Switch
                  checked={editingCategory.isActive}
                  onCheckedChange={(checked) =>
                    setEditingCategory((prev) => (prev ? { ...prev, isActive: checked } : null))
                  }
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={busy}
                >
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={busy} className="gap-1.5">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {locale === "ar" ? "حفظ التصنيف" : "Save Category"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
