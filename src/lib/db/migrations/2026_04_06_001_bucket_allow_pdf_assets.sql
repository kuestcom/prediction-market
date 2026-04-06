DO
$$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'storage'
        AND table_name = 'buckets'
    ) THEN
      UPDATE storage.buckets
      SET
        file_size_limit = 2097152,
        allowed_mime_types = ARRAY(
          SELECT DISTINCT mime
          FROM unnest(
            COALESCE(allowed_mime_types, ARRAY[]::text[])
            || ARRAY['application/pdf']
          ) AS mime
        )
      WHERE id = 'kuest-assets';
    END IF;
  END
$$;
