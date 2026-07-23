CREATE SCHEMA IF NOT EXISTS extensions;

DO
$$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_extension
      WHERE extname = 'pg_trgm'
        AND extnamespace = 'public'::regnamespace
    ) THEN
      EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_extension
      WHERE extname = 'pgcrypto'
        AND extnamespace = 'public'::regnamespace
    ) THEN
      EXECUTE 'ALTER EXTENSION pgcrypto SET SCHEMA extensions';
    END IF;
  END
$$;

DO
$$
  BEGIN
    IF to_regclass('storage.objects') IS NOT NULL THEN
      EXECUTE 'DROP POLICY IF EXISTS "Public read assets" ON storage.objects';
    END IF;
  END
$$;

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_user_id
  ON public.affiliate_referrals (affiliate_user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_event_id
  ON public.bookmarks (event_id);

CREATE INDEX IF NOT EXISTS idx_event_creations_deployed_event_id
  ON public.event_creations (deployed_event_id);

CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id
  ON public.users (referred_by_user_id);

CREATE INDEX IF NOT EXISTS idx_event_creations_updated_by_user_id
  ON public.event_creations (updated_by_user_id);

CREATE INDEX IF NOT EXISTS idx_events_slug_lower_gin_trgm
  ON public.events USING GIN (LOWER(slug) extensions.gin_trgm_ops);
