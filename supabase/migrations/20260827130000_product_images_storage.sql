-- Ensure product-images storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- RLS policies for product-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'product_images_public_read'
  ) THEN
    CREATE POLICY "product_images_public_read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'product-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'product_images_admin_insert'
  ) THEN
    CREATE POLICY "product_images_admin_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'ADMIN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'product_images_admin_update'
  ) THEN
    CREATE POLICY "product_images_admin_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'ADMIN'))
      WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'ADMIN'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'product_images_admin_delete'
  ) THEN
    CREATE POLICY "product_images_admin_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'ADMIN'));
  END IF;
END $$;
