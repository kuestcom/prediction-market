-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE event_translations
(
  event_id     CHAR(26)    NOT NULL REFERENCES events (id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale       TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  source_hash  TEXT        NOT NULL,
  is_manual    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, locale),
  CHECK (locale <> 'en')
);

CREATE TABLE event_translation_jobs
(
  event_id       CHAR(26)    NOT NULL REFERENCES events (id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale         TEXT        NOT NULL,
  source_title   TEXT        NOT NULL,
  source_hash    TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending',
  attempts       SMALLINT    NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, locale),
  CHECK (locale <> 'en'),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CHECK (attempts >= 0)
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

CREATE INDEX idx_event_translations_locale ON event_translations (locale);
CREATE INDEX idx_event_translation_jobs_status_next_attempt ON event_translation_jobs (status, next_attempt_at);

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE event_translations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE event_translation_jobs
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_event_translations" ON "event_translations" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_event_translation_jobs" ON "event_translation_jobs" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. TRIGGERS
-- ===========================================

CREATE TRIGGER set_event_translations_updated_at
  BEFORE UPDATE
  ON event_translations
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_event_translation_jobs_updated_at
  BEFORE UPDATE
  ON event_translation_jobs
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
