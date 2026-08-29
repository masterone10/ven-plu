import { useState, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { MediaInput, VariantInput } from "@/lib/admin-product-rules";
import { uploadProductMedia, deleteProductMedia } from "@/lib/admin-products.functions";

type AdminImageUploaderProps = {
  media: MediaInput[];
  variants: VariantInput[];
  productNameEn: string;
  productNameAr: string;
  onChange: (updated: MediaInput[]) => void;
};

type UploadingItem = {
  id: string;
  name: string;
  previewUrl: string;
};

export function AdminImageUploader({
  media,
  variants,
  productNameEn,
  productNameAr,
  onChange,
}: AdminImageUploaderProps) {
  const { locale } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetIndex, setReplaceTargetIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingItem[]>([]);
  const [urlInput, setUrlInput] = useState("");

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const validFiles: File[] = [];

    for (const file of fileList) {
      if (!file.type.startsWith("image/")) {
        toast.error(
          locale === "ar"
            ? `الملف ${file.name} ليس صورة صالحة`
            : `File ${file.name} is not a valid image`,
        );
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(
          locale === "ar"
            ? `حجم الصورة ${file.name} يتجاوز 10 ميغابايت`
            : `File ${file.name} exceeds 10MB limit`,
        );
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    const activeUploading: UploadingItem[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));
    setUploadingFiles((prev) => [...prev, ...activeUploading]);

    const uploadedMediaItems: MediaInput[] = [];
    let successCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const uploadItem = activeUploading[i];
      if (!file || !uploadItem) continue;

      try {
        const base64Data = await readFileAsBase64(file);
        const result = await uploadProductMedia({
          data: {
            fileName: file.name,
            contentType: file.type || "image/jpeg",
            base64Data,
          },
        });

        if (result?.url) {
          uploadedMediaItems.push({
            url: result.url,
            altEn: productNameEn || file.name.replace(/\.[^/.]+$/, ""),
            altAr: productNameAr || "صورة المنتج",
            variantSku: null,
            sortOrder: media.length + uploadedMediaItems.length,
            isPrimary: media.length === 0 && uploadedMediaItems.length === 0,
          });
          successCount++;
        }
      } catch (err) {
        console.error("Failed to upload image:", err);
        toast.error(
          locale === "ar" ? `فشل رفع الصورة: ${file.name}` : `Failed to upload image: ${file.name}`,
        );
      } finally {
        URL.revokeObjectURL(uploadItem.previewUrl);
        setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadItem.id));
      }
    }

    setIsUploading(false);

    if (uploadedMediaItems.length > 0) {
      onChange([...media, ...uploadedMediaItems]);
      toast.success(
        locale === "ar"
          ? `تم رفع ${successCount} صورة وحفظها بنجاح`
          : `Successfully uploaded ${successCount} image(s)`,
      );
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceTargetIndex === null) return;

    if (!file.type.startsWith("image/")) {
      toast.error(locale === "ar" ? "الملف ليس صورة صالحة" : "File is not a valid image");
      return;
    }

    const toastId = toast.loading(
      locale === "ar" ? "جاري استبدال الصورة..." : "Replacing image...",
    );
    try {
      const base64Data = await readFileAsBase64(file);
      const result = await uploadProductMedia({
        data: {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data,
        },
      });

      if (result?.url) {
        const updated = [...media];
        const old = updated[replaceTargetIndex];
        if (old) {
          updated[replaceTargetIndex] = {
            ...old,
            url: result.url,
          };
          onChange(updated);
          toast.success(
            locale === "ar" ? "تم استبدال الصورة بنجاح" : "Image replaced successfully",
            {
              id: toastId,
            },
          );
        }
      }
    } catch (err) {
      console.error("Failed to replace image:", err);
      toast.error(locale === "ar" ? "فشل استبدال الصورة" : "Failed to replace image", {
        id: toastId,
      });
    } finally {
      setReplaceTargetIndex(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const trimmed = urlInput.trim();

    if (trimmed.startsWith("data:")) {
      toast.error(
        locale === "ar"
          ? "لا يمكن استخدام روابط Base64 مباشرة. يرجى استخدام خاصية الرفع."
          : "Base64 data URLs cannot be saved directly. Please use file upload.",
      );
      return;
    }

    if (trimmed.length > 2048) {
      toast.error(
        locale === "ar"
          ? "رابط الصورة طويل جداً (الحد الأقصى 2048 حرف)"
          : "Image URL is too long (max 2048 characters)",
      );
      return;
    }

    const newMedia: MediaInput = {
      url: trimmed,
      altEn: productNameEn || "Product image",
      altAr: productNameAr || "صورة المنتج",
      variantSku: null,
      sortOrder: media.length,
      isPrimary: media.length === 0,
    };
    onChange([...media, newMedia]);
    setUrlInput("");
    toast.success(locale === "ar" ? "تمت إضافة رابط الصورة" : "Image URL added");
  };

  const handleSetPrimary = (index: number) => {
    const updated = media.map((item, idx) => ({
      ...item,
      isPrimary: idx === index,
    }));
    onChange(updated);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= media.length) return;

    const updated = [...media];
    const temp = updated[index];
    const targetItem = updated[targetIdx];
    if (temp && targetItem) {
      updated[index] = targetItem;
      updated[targetIdx] = temp;
      onChange(
        updated.map((item, idx) => ({
          ...item,
          sortOrder: idx,
        })),
      );
    }
  };

  const handleRemove = (index: number) => {
    const target = media[index];
    const updated = media.filter((_, idx) => idx !== index);
    if (updated.length > 0 && !updated.some((m) => m.isPrimary)) {
      const first = updated[0];
      if (first) first.isPrimary = true;
    }
    onChange(
      updated.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      })),
    );

    // If it was a storage URL from our bucket, fire-and-forget cleanup
    if (target?.url && target.url.includes("/product-images/products/")) {
      const match = target.url.match(/product-images\/(products\/[^?#]+)/);
      if (match?.[1]) {
        void deleteProductMedia({ data: { path: match[1] } }).catch(() => {
          // Non-blocking cleanup
        });
      }
    }
  };

  const handleUpdate = (index: number, updates: Partial<MediaInput>) => {
    const updated = media.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, ...updates };
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input for Image Replacement */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceFile}
      />

      {/* Drag and Drop Zone */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 bg-muted/20"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        {isUploading ? (
          <Loader2 className="size-10 animate-spin text-primary" />
        ) : (
          <UploadCloud className="size-10 text-muted-foreground" />
        )}
        <p className="mt-2 text-sm font-semibold text-foreground">
          {locale === "ar"
            ? "اسحب وأفلت صور المنتج هنا، أو انقر للاختيار"
            : "Drag & drop product images here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {locale === "ar"
            ? "يدعم ملفات JPG, PNG, WebP (يتم الرفع إلى وحدة التخزين تلقائياً)"
            : "Supports JPG, PNG, WebP (automatically uploaded to Supabase Storage)"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isUploading}
          className="mt-3 gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {locale === "ar" ? "جاري الرفع..." : "Uploading..."}
            </>
          ) : (
            <>
              <ImageIcon className="size-4" />
              {locale === "ar" ? "تصفح الصور للرفع" : "Browse & Upload Images"}
            </>
          )}
        </Button>
      </div>

      {/* Active Uploading Queue Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            {locale === "ar"
              ? `جاري معالجة ورفع ${uploadingFiles.length} صورة...`
              : `Uploading and processing ${uploadingFiles.length} image(s)...`}
          </p>
          <div className="flex flex-wrap gap-2">
            {uploadingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded bg-background/80 px-2.5 py-1 text-xs border border-border"
              >
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="size-5 rounded object-cover"
                />
                <span className="max-w-[150px] truncate font-mono text-[11px]">{file.name}</span>
                <Loader2 className="size-3 animate-spin text-primary shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Direct URL Input */}
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder={
            locale === "ar"
              ? "أو أدخل رابط صورة خارجي مباشر (https://...)"
              : "Or enter direct external image URL (https://...)"
          }
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddUrl();
            }
          }}
          className="text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddUrl}
          disabled={!urlInput.trim() || isUploading}
          className="shrink-0 gap-1"
        >
          <LinkIcon className="size-3.5" />
          {locale === "ar" ? "إضافة رابط" : "Add URL"}
        </Button>
      </div>

      {/* Media Gallery List */}
      <div className="space-y-2">
        {media.length === 0 && uploadingFiles.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-xs text-muted-foreground">
            {locale === "ar"
              ? "لا توجد صور مضافة للمنتج حتى الآن."
              : "No product images added yet."}
          </div>
        ) : (
          media.map((img, index) => (
            <div
              key={index}
              className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                img.isPrimary ? "border-primary/50 bg-primary/5" : "border-border bg-card"
              }`}
            >
              {/* Thumbnail & Primary status */}
              <div className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <img
                    src={img.url}
                    alt={img.altEn || "preview"}
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/favicon.ico";
                    }}
                  />
                  {img.isPrimary && (
                    <div className="absolute top-1 start-1 rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground shadow">
                      {locale === "ar" ? "رئيسية" : "Primary"}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={img.isPrimary ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleSetPrimary(index)}
                    >
                      <Star className={`size-3 ${img.isPrimary ? "fill-current" : ""}`} />
                      {img.isPrimary
                        ? locale === "ar"
                          ? "الصورة الرئيسية"
                          : "Primary Image"
                        : locale === "ar"
                          ? "تعيين كرئيسية"
                          : "Set as Primary"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setReplaceTargetIndex(index);
                        replaceInputRef.current?.click();
                      }}
                    >
                      <RefreshCw className="size-3" />
                      {locale === "ar" ? "استبدال" : "Replace"}
                    </Button>
                  </div>
                  <p
                    className="max-w-[200px] truncate text-[11px] font-mono text-muted-foreground sm:max-w-xs"
                    title={img.url}
                  >
                    {img.url}
                  </p>
                </div>
              </div>

              {/* Variant and Alt controls */}
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "ربط بالمتغير (اختياري)" : "Link to Variant (Optional)"}
                  </Label>
                  <Select
                    value={img.variantSku ?? "all"}
                    onValueChange={(val) =>
                      handleUpdate(index, { variantSku: val === "all" ? null : val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All Variants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {locale === "ar" ? "عام لكل المتغيرات" : "Shared / All Variants"}
                      </SelectItem>
                      {variants.map((v) => (
                        <SelectItem key={v.sku} value={v.sku}>
                          {v.sku} ({locale === "ar" ? v.nameAr : v.nameEn})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "النص البديل (AR)" : "Alt Text (AR)"}
                  </Label>
                  <Input
                    value={img.altAr ?? ""}
                    onChange={(e) => handleUpdate(index, { altAr: e.target.value })}
                    placeholder="وصف الصورة"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => handleMove(index, "up")}
                  title="Move Up"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === media.length - 1}
                  onClick={() => handleMove(index, "down")}
                  title="Move Down"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(index)}
                  title="Delete Image"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
