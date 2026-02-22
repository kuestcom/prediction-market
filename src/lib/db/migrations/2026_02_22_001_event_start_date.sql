-- ===========================================
-- Event start date
-- ===========================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;

-- ===========================================
-- Series social tracker mappings
-- ===========================================

CREATE TABLE IF NOT EXISTS series_social_trackers
(
  id                     SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  series_slug            TEXT        NOT NULL,
  platform               TEXT        NOT NULL DEFAULT 'X',
  handle                 TEXT        NOT NULL,
  display_name           TEXT        NOT NULL,
  is_verified            BOOLEAN     NOT NULL DEFAULT FALSE,
  bio                    TEXT,
  is_active              BOOLEAN     NOT NULL DEFAULT TRUE,
  priority               SMALLINT    NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT series_social_trackers_platform_check CHECK (platform IN ('X', 'TRUTH_SOCIAL')),
  CONSTRAINT series_social_trackers_priority_check CHECK (priority >= 0),
  CONSTRAINT series_social_trackers_series_slug_platform_handle_key UNIQUE (series_slug, platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_series_social_trackers_series_slug
  ON series_social_trackers (series_slug);

CREATE INDEX IF NOT EXISTS idx_series_social_trackers_series_slug_active
  ON series_social_trackers (series_slug, is_active);

ALTER TABLE series_social_trackers
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_series_social_trackers" ON "series_social_trackers";
CREATE POLICY "service_role_all_series_social_trackers"
  ON "series_social_trackers"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_series_social_trackers_updated_at ON series_social_trackers;
CREATE TRIGGER set_series_social_trackers_updated_at
  BEFORE UPDATE
  ON series_social_trackers
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO series_social_trackers (
  series_slug,
  platform,
  handle,
  display_name,
  is_verified,
  bio,
  is_active,
  priority
)
VALUES
  (
    'elon-tweets',
    'X',
    'elonmusk',
    'Elon Musk',
    FALSE,
    NULL,
    TRUE,
    10
  ),
  (
    'elon-tweet-daily',
    'X',
    'elonmusk',
    'Elon Musk',
    FALSE,
    NULL,
    TRUE,
    10
  ),
  (
    'elon-tweets-48h',
    'X',
    'elonmusk',
    'Elon Musk',
    FALSE,
    NULL,
    TRUE,
    10
  ),
  (
    'trump-truth-social',
    'TRUTH_SOCIAL',
    'realDonaldTrump',
    'Donald J. Trump',
    TRUE,
    'p/p',
    TRUE,
    10
  ),
  (
    'andrew-tate-tweets',
    'X',
    'Cobratate',
    'Andrew Tate',
    FALSE,
    'Unmatched perspicacity coupled with sheer indefatigability makes me a feared opponent in any realm of human endeavour. Escape Slavery: https://t.co/b2DF1rm9ij',
    TRUE,
    10
  )
ON CONFLICT (series_slug, platform, handle)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_verified = EXCLUDED.is_verified,
  bio = EXCLUDED.bio,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  updated_at = NOW();
