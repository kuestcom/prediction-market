-- ===========================================
-- Home featured events
-- ===========================================

CREATE TABLE IF NOT EXISTS home_featured_events (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  target_type TEXT NOT NULL DEFAULT 'event',
  event_id CHAR(26) REFERENCES events (id) ON DELETE CASCADE ON UPDATE CASCADE,
  series_slug TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rank INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  context_mode TEXT NOT NULL DEFAULT 'auto',
  auto_rollover_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (target_type IN ('event', 'series')),
  CHECK (source IN ('manual', 'ai')),
  CHECK (context_mode IN ('auto', 'news', 'comments', 'hidden')),
  CHECK (
    (target_type = 'event' AND event_id IS NOT NULL AND series_slug IS NULL)
    OR (target_type = 'series' AND event_id IS NULL AND TRIM(COALESCE(series_slug, '')) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_home_featured_events_enabled_rank
  ON home_featured_events (enabled, rank);

CREATE INDEX IF NOT EXISTS idx_home_featured_events_event_id
  ON home_featured_events (event_id);

CREATE INDEX IF NOT EXISTS idx_home_featured_events_series_slug
  ON home_featured_events (series_slug);

CREATE INDEX IF NOT EXISTS idx_home_featured_events_starts_at
  ON home_featured_events (starts_at);

CREATE INDEX IF NOT EXISTS idx_home_featured_events_ends_at
  ON home_featured_events (ends_at);

ALTER TABLE home_featured_events
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_home_featured_events" ON "home_featured_events";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_role_all_home_featured_events"
      ON "home_featured_events"
      AS PERMISSIVE
      FOR ALL
      TO "service_role"
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_home_featured_events_updated_at ON home_featured_events;
CREATE TRIGGER set_home_featured_events_updated_at
  BEFORE UPDATE
  ON home_featured_events
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS home_featured_event_context_items (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  featured_event_id CHAR(26) NOT NULL REFERENCES home_featured_events (id) ON DELETE CASCADE ON UPDATE CASCADE,
  event_id CHAR(26) NOT NULL REFERENCES events (id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en',
  item_type TEXT NOT NULL DEFAULT 'news',
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  favicon_url TEXT,
  published_at TIMESTAMPTZ,
  relevance_score DECIMAL(8, 4),
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (item_type IN ('news', 'comment')),
  CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_home_featured_context_featured_locale
  ON home_featured_event_context_items (featured_event_id, locale);

CREATE INDEX IF NOT EXISTS idx_home_featured_context_event_locale_expires
  ON home_featured_event_context_items (event_id, locale, expires_at);

CREATE INDEX IF NOT EXISTS idx_home_featured_context_expires_at
  ON home_featured_event_context_items (expires_at);

ALTER TABLE home_featured_event_context_items
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_home_featured_event_context_items" ON "home_featured_event_context_items";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_role_all_home_featured_event_context_items"
      ON "home_featured_event_context_items"
      AS PERMISSIVE
      FOR ALL
      TO "service_role"
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_home_featured_event_context_items_updated_at ON home_featured_event_context_items;
CREATE TRIGGER set_home_featured_event_context_items_updated_at
  BEFORE UPDATE
  ON home_featured_event_context_items
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
