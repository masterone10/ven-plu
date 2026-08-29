import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Edit,
  FolderPlus,
  Layers,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  deleteAdminCategory,
  listAdminCategories,
  saveAdminCategory,
  toggleAdminCategoryActive,
  type AdminCategoryWithCount,
} from "@/lib/admin-categories.functions";

export function AdminCategoriesView() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const fetchCategories = useServerFn(listAdminCategories);
  const saveCategory = useServerFn(saveAdminCategory);
  const toggleActive = useServerFn(toggleAdminCategoryActive);
  const deleteCategory = useServerFn(deleteAdminCategory);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => fetchCategories(),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [editingCategory, setEditingCategory] = useState<AdminCategoryWithCount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<AdminCategoryWithCount | null>(null);

  // Form states
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const filteredCategories = categories.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.nameEn.toLowerCase().includes(term) ||
      c.nameAr.toLowerCase().includes(term) ||
      c.slug.toLowerCase().includes(term)
    );
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { categoryId: string; isActive: boolean }) => toggleActive({ data: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(locale === "ar" ? "تم تحديث حالة التصنيف" : "Category status updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to toggle status");
    },
  });

  const saveMutation = useMutation({
    mutationFn: (vars: {
      id?: string;
      slug: string;
      nameEn: string;
      nameAr: string;
      sortOrder: number;
      isActive: boolean;
    }) => saveCategory({ data: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(locale === "ar" ? "تم حفظ التصنيف بنجاح" : "Category saved successfully");
      setIsCreating(false);
      setEditingCategory(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { categoryId: string }) => deleteCategory({ data: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(locale === "ar" ? "تم حذف التصنيف بنجاح" : "Category deleted successfully");
      setDeletingCategory(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    },
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameEnChange = (val: string) => {
    setNameEn(val);
    if (!isSlugManuallyEdited && isCreating) {
      const generated = slugify(val);
      if (generated) setSlug(generated);
    }
  };

  const handleOpenCreate = () => {
    setSlug("");
    setNameEn("");
    setNameAr("");
    setSortOrder((categories.length + 1) * 10);
    setIsActive(true);
    setIsCreating(true);
    setIsSlugManuallyEdited(false);
    setEditingCategory(null);
  };

  const handleOpenEdit = (cat: AdminCategoryWithCount) => {
    setSlug(cat.slug);
    setNameEn(cat.nameEn);
    setNameAr(cat.nameAr);
    setSortOrder(cat.sortOrder);
    setIsActive(cat.isActive);
    setEditingCategory(cat);
    setIsCreating(false);
    setIsSlugManuallyEdited(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !nameEn.trim() || !nameAr.trim()) {
      toast.error(
        locale === "ar" ? "يرجى تعبئة كافة الحقول المطلوبة" : "Please fill in all required fields",
      );
      return;
    }

    saveMutation.mutate({
      ...(editingCategory ? { id: editingCategory.id } : {}),
      slug: slug.trim().toLowerCase(),
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      sortOrder: Number(sortOrder),
      isActive,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">
            {locale === "ar" ? "إدارة تصنيفات المنتجات" : "Categories Management"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {locale === "ar"
              ? "إضافة وتعديل وحذف تصنيفات المتجر وترتيب ظهورها وربطها بالمنتجات."
              : "Create, edit, and organize product categories and display ordering."}
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="size-4" />
          {locale === "ar" ? "إضافة تصنيف جديد" : "New Category"}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={locale === "ar" ? "بحث في التصنيفات..." : "Search categories..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ps-9 max-w-md"
        />
      </div>

      {/* Categories Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="size-10 text-muted-foreground" />
            <p className="mt-4 text-base font-semibold">
              {locale === "ar" ? "لا توجد تصنيفات" : "No categories found"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {locale === "ar"
                ? "انقر على زر إضافة تصنيف جديد للبدء."
                : "Click 'New Category' to create your first category."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">
                    {locale === "ar" ? "التصنيف" : "Category"}
                  </th>
                  <th className="px-4 py-3 text-start">
                    {locale === "ar" ? "الرابط (Slug)" : "Slug"}
                  </th>
                  <th className="px-4 py-3 text-start">
                    {locale === "ar" ? "الترتيب" : "Sort Order"}
                  </th>
                  <th className="px-4 py-3 text-start">
                    {locale === "ar" ? "المنتجات" : "Products"}
                  </th>
                  <th className="px-4 py-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end">
                    {locale === "ar" ? "الإجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {locale === "ar" ? category.nameAr : category.nameEn}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {locale === "ar" ? category.nameEn : category.nameAr}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {category.slug}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs">{category.sortOrder}</td>

                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="gap-1 font-mono text-xs">
                        <Package className="size-3" />
                        {category.productCount}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={category.isActive}
                          disabled={toggleMutation.isPending}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({
                              categoryId: category.id,
                              isActive: checked,
                            })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {category.isActive
                            ? locale === "ar"
                              ? "نشط"
                              : "Active"
                            : locale === "ar"
                              ? "معطل"
                              : "Disabled"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(category)}
                          className="gap-1 text-xs"
                        >
                          <Edit className="size-3.5" />
                          {locale === "ar" ? "تعديل" : "Edit"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingCategory(category)}
                          title="Delete Category"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save / Edit Category Modal */}
      {(isCreating || editingCategory) && (
        <Dialog
          open
          onOpenChange={() => {
            setIsCreating(false);
            setEditingCategory(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCategory
                  ? locale === "ar"
                    ? "تعديل التصنيف"
                    : "Edit Category"
                  : locale === "ar"
                    ? "إضافة تصنيف جديد"
                    : "New Category"}
              </DialogTitle>
              <DialogDescription>
                {locale === "ar"
                  ? "أدخل بيانات التصنيف باللغتين العربية والإنجليزية."
                  : "Enter category details in Arabic and English."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug">
                  {locale === "ar" ? "الرابط الدائم (Slug)" : "Slug"}
                </Label>
                <Input
                  id="cat-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setIsSlugManuallyEdited(true);
                  }}
                  placeholder="e.g. skincare"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-name-en">
                  {locale === "ar" ? "الاسم بالإنجليزية" : "English Name"}
                </Label>
                <Input
                  id="cat-name-en"
                  value={nameEn}
                  onChange={(e) => handleNameEnChange(e.target.value)}
                  placeholder="Skincare"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-name-ar">
                  {locale === "ar" ? "الاسم بالعربية" : "Arabic Name"}
                </Label>
                <Input
                  id="cat-name-ar"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="العناية بالبشرة"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-sort">{locale === "ar" ? "الترتيب" : "Sort Order"}</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch id="cat-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="cat-active" className="cursor-pointer">
                  {isActive
                    ? locale === "ar"
                      ? "التصنيف مفعل ونشط"
                      : "Category is Active"
                    : locale === "ar"
                      ? "التصنيف معطل"
                      : "Category is Inactive"}
                </Label>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingCategory(null);
                  }}
                >
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={saveMutation.isPending} className="gap-1.5">
                  {saveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {locale === "ar" ? "حفظ التصنيف" : "Save Category"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <Dialog open onOpenChange={() => setDeletingCategory(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                {locale === "ar" ? "تأكيد حذف التصنيف" : "Confirm Category Deletion"}
              </DialogTitle>
              <DialogDescription>
                {locale === "ar"
                  ? `هل أنت متأكد من حذف تصنيف "${deletingCategory.nameAr}"؟ إذا كانت هناك منتجات مرتبطة به، فسيتم فك ارتباطها تلقائياً دون حذف المنتجات.`
                  : `Are you sure you want to delete category "${deletingCategory.nameEn}"? Any linked products will have their category cleared without being deleted.`}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDeletingCategory(null)}>
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ categoryId: deletingCategory.id })}
                className="gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {locale === "ar" ? "تأكيد الحذف" : "Delete Category"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
