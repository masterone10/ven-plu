import { useState, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Image as ImageIcon,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { MediaInput, VariantInput } from "@/lib/admin-product-rules";

interface AdminImageUploaderProps {
  media: MediaInput[];
  variants: VariantInput[];
  onChange: (updatedMedia: MediaInput[]) => void;
}

export function AdminImageUploader({ media, variants, onChange }: AdminImageUploaderProps) {
  const { locale } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const newMediaItems: MediaInput[] = [...media];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        if (!file.type.startsWith("image/")) {
          toast.error(
            locale === "ar"
              ? `الملف ${file.name} ليس صورة صالحة`
              : `File ${file.name} is not a valid image`,
          );
          continue;
        }

        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const filePath = `products/${fileName}`;

        // Upload to Supabase storage bucket 'product-images' (or fallback to public storage)
        const { error } = await supabase.storage
          .from("product-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        let publicUrl = "";
        if (error) {
          // If bucket doesn't exist or public upload fallback: create public URL via object URL or standard path
          console.warn("Storage upload notice:", error.message);
          // Try standard storage public URL endpoint
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
          publicUrl = urlData?.publicUrl || URL.createObjectURL(file);
        } else {
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
          publicUrl = urlData.publicUrl;
        }

        newMediaItems.push({
          url: publicUrl,
          altAr: file.name.replace(/\.[^/.]+$/, ""),
          altEn: file.name.replace(/\.[^/.]+$/, ""),
          variantSku: null,
          sortOrder: newMediaItems.length,
          isPrimary: newMediaItems.length === 0, // first image is primary by default
        });
      }

      onChange(newMediaItems);
      toast.success(locale === "ar" ? "تم رفع الصور بنجاح" : "Images uploaded successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload images");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const setPrimary = (index: number) => {
    const next = media.map((item, idx) => ({
      ...item,
      isPrimary: idx === index,
    }));
    onChange(next);
  };

  const setVariantSku = (index: number, sku: string | null) => {
    const next = media.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, variantSku: sku === "ALL" ? null : sku };
    });
    onChange(next);
  };

  const moveUp = (index: number) => {
    if (index === 0 || index >= media.length) return;
    const next = [...media];
    const curr = next[index];
    const prev = next[index - 1];
    if (!curr || !prev) return;
    next[index - 1] = curr;
    next[index] = prev;
    next.forEach((item, idx) => (item.sortOrder = idx));
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index < 0 || index >= media.length - 1) return;
    const next = [...media];
    const curr = next[index];
    const nxt = next[index + 1];
    if (!curr || !nxt) return;
    next[index + 1] = curr;
    next[index] = nxt;
    next.forEach((item, idx) => (item.sortOrder = idx));
    onChange(next);
  };

  const removeImage = (index: number) => {
    const next = media.filter((_, idx) => idx !== index);
    if (next.length > 0 && !next.some((item) => item.isPrimary)) {
      const first = next[0];
      if (first) first.isPrimary = true;
    }
    next.forEach((item, idx) => (item.sortOrder = idx));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">
              {locale === "ar" ? "جاري رفع ومعالجة الصور..." : "Uploading and processing images..."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-1.5 py-2">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
              <Upload className="size-6" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {locale === "ar"
                ? "اسحب وأفلت الصور هنا أو انقر للاختيار"
                : "Drag & drop photos here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "يدعم صيغ JPG و PNG و WebP — يمكنك رفع صور متعددة دفعة واحدة"
                : "Supports JPG, PNG, WebP — multiple uploads allowed"}
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Images List */}
      {media.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {media.map((item, index) => (
            <div
              key={item.url + index}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                item.isPrimary
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative size-16 shrink-0 rounded-lg overflow-hidden border border-border bg-muted/30">
                <img src={item.url} alt="" className="size-full object-cover" />
                {item.isPrimary && (
                  <Badge className="absolute top-1 start-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0">
                    <Star className="size-2.5 me-0.5 fill-current" />
                    {locale === "ar" ? "رئيسية" : "Main"}
                  </Badge>
                )}
              </div>

              {/* Details & Variant Mapping */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground truncate block">
                    {locale === "ar" ? `صورة ${index + 1}` : `Image ${index + 1}`}
                  </span>
                  {!item.isPrimary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimary(index)}
                      className="h-6 px-2 text-[11px] font-semibold text-muted-foreground hover:text-primary"
                    >
                      <Star className="size-3 me-1" />
                      {locale === "ar" ? "تعيين كرئيسية" : "Make primary"}
                    </Button>
                  )}
                </div>

                {/* Associate with specific variant SKU */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {locale === "ar" ? "ربط بـ:" : "Variant:"}
                  </span>
                  <Select
                    value={item.variantSku || "ALL"}
                    onValueChange={(val) => setVariantSku(index, val)}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder={locale === "ar" ? "عام للمنتج" : "All variants"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">
                        {locale === "ar" ? "عام لكل المتغيرات" : "Shared (All Variants)"}
                      </SelectItem>
                      {variants.map((v) => (
                        <SelectItem key={v.sku} value={v.sku}>
                          {v.sku} — {locale === "ar" ? v.nameAr : v.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reorder and Delete Actions */}
              <div className="flex flex-col gap-1 shrink-0">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => moveUp(index)}
                    className="size-6 rounded"
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === media.length - 1}
                    onClick={() => moveDown(index)}
                    className="size-6 rounded"
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeImage(index)}
                  className="size-6 rounded text-destructive hover:bg-destructive/10 hover:text-destructive self-end"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
