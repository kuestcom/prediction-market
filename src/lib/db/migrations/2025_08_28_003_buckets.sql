DO
$$
  BEGIN
    -- Supabase storage objects are optional outside Supabase mode.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('kuest-assets',
              'kuest-assets',
              TRUE,
              2097152,
              ARRAY ['image/jpeg', 'image/png', 'image/webp'])
      ON CONFLICT (id) DO NOTHING;

      IF NOT EXISTS (SELECT 1
                     FROM pg_policies
                     WHERE policyname = 'Public read assets'
                       AND tablename = 'objects'
                       AND schemaname = 'storage') THEN
        CREATE POLICY "Public read assets" ON storage.objects
          FOR SELECT TO PUBLIC
          USING (bucket_id = 'kuest-assets');
      END IF;

      IF NOT EXISTS (SELECT 1
                     FROM pg_policies
                     WHERE policyname = 'Service role full asset access'
                       AND tablename = 'objects'
                       AND schemaname = 'storage') THEN
        CREATE POLICY "Service role full asset access" ON storage.objects
          FOR ALL TO service_role
          USING (bucket_id = 'kuest-assets')
          WITH CHECK (bucket_id = 'kuest-assets');
      END IF;
    END IF;
  END
$$;
