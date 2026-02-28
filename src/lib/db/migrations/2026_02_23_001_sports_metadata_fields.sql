-- ===========================================
-- Sports metadata fields
-- ===========================================

CREATE TABLE IF NOT EXISTS event_sports (
  event_id CHAR(26) PRIMARY KEY
    REFERENCES events (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  sports_event_id TEXT,
  sports_event_slug TEXT,
  sports_parent_event_id BIGINT,
  sports_game_id BIGINT,
  sports_event_date DATE,
  sports_start_time TIMESTAMPTZ,
  sports_series_slug TEXT,
  sports_series_id TEXT,
  sports_series_recurrence TEXT,
  sports_series_color TEXT,
  sports_sport_slug TEXT,
  sports_event_week INTEGER,
  sports_score TEXT,
  sports_period TEXT,
  sports_elapsed TEXT,
  sports_live BOOLEAN,
  sports_ended BOOLEAN,
  sports_tags JSONB,
  sports_teams JSONB,
  sports_team_logo_urls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_sports_event_id
  ON event_sports (sports_event_id);

CREATE INDEX IF NOT EXISTS idx_event_sports_parent_event_id
  ON event_sports (sports_parent_event_id);

CREATE INDEX IF NOT EXISTS idx_event_sports_game_id
  ON event_sports (sports_game_id);

CREATE INDEX IF NOT EXISTS idx_event_sports_event_slug
  ON event_sports (sports_event_slug);

CREATE INDEX IF NOT EXISTS idx_event_sports_series_slug
  ON event_sports (sports_series_slug);

CREATE INDEX IF NOT EXISTS idx_event_sports_series_id
  ON event_sports (sports_series_id);

CREATE INDEX IF NOT EXISTS idx_event_sports_sport_slug
  ON event_sports (sports_sport_slug);

CREATE INDEX IF NOT EXISTS idx_event_sports_teams_gin
  ON event_sports
  USING GIN (sports_teams);

CREATE INDEX IF NOT EXISTS idx_events_status_active_markets_count
  ON events (status, active_markets_count);

CREATE TABLE IF NOT EXISTS market_sports (
  condition_id TEXT PRIMARY KEY
    REFERENCES markets (condition_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  event_id CHAR(26)
    REFERENCES events (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  sports_market_type TEXT,
  sports_line NUMERIC(20, 8),
  sports_group_item_title TEXT,
  sports_group_item_threshold TEXT,
  sports_game_start_time TIMESTAMPTZ,
  sports_event_id BIGINT,
  sports_parent_event_id BIGINT,
  sports_game_id BIGINT,
  sports_event_date DATE,
  sports_start_time TIMESTAMPTZ,
  sports_series_color TEXT,
  sports_event_slug TEXT,
  sports_teams JSONB,
  sports_team_logo_urls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_sports_market_type
  ON market_sports (sports_market_type);

CREATE INDEX IF NOT EXISTS idx_market_sports_event_id
  ON market_sports (sports_event_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_parent_event_id
  ON market_sports (sports_parent_event_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_game_id
  ON market_sports (sports_game_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_event_fk
  ON market_sports (event_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_event_slug
  ON market_sports (sports_event_slug);

CREATE INDEX IF NOT EXISTS idx_market_sports_teams_gin
  ON market_sports
  USING GIN (sports_teams);

ALTER TABLE event_sports
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE market_sports
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_event_sports" ON "event_sports";
CREATE POLICY "service_role_all_event_sports"
  ON "event_sports"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "service_role_all_market_sports" ON "market_sports";
CREATE POLICY "service_role_all_market_sports"
  ON "market_sports"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);
