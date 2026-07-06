ALTER TABLE event_sports
  ADD COLUMN IF NOT EXISTS sports_source_provider TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_event_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_game_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_league_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_league_label TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_match_confidence NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS sports_source_payload JSONB,
  ADD COLUMN IF NOT EXISTS sports_source_selected_at TIMESTAMPTZ;

ALTER TABLE market_sports
  ADD COLUMN IF NOT EXISTS sports_source_provider TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_event_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_game_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_league_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_league_label TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_market_id TEXT,
  ADD COLUMN IF NOT EXISTS sports_source_match_confidence NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS sports_source_payload JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_sports_source_match_confidence_range'
  ) THEN
    ALTER TABLE event_sports
      ADD CONSTRAINT event_sports_source_match_confidence_range
      CHECK (
        sports_source_match_confidence IS NULL
        OR (
          sports_source_match_confidence >= 0
          AND sports_source_match_confidence <= 1
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'market_sports_source_match_confidence_range'
  ) THEN
    ALTER TABLE market_sports
      ADD CONSTRAINT market_sports_source_match_confidence_range
      CHECK (
        sports_source_match_confidence IS NULL
        OR (
          sports_source_match_confidence >= 0
          AND sports_source_match_confidence <= 1
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_sports_source_event
  ON event_sports (sports_source_provider, sports_source_event_id);

CREATE INDEX IF NOT EXISTS idx_event_sports_source_game
  ON event_sports (sports_source_provider, sports_source_game_id);

CREATE INDEX IF NOT EXISTS idx_event_sports_source_league
  ON event_sports (sports_source_provider, sports_source_league_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_source_event
  ON market_sports (sports_source_provider, sports_source_event_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_source_game
  ON market_sports (sports_source_provider, sports_source_game_id);

CREATE INDEX IF NOT EXISTS idx_market_sports_source_league
  ON market_sports (sports_source_provider, sports_source_league_id);

INSERT INTO settings ("group", key, value)
VALUES ('ai', 'sports_thesportsdb_api_key', '123')
ON CONFLICT ("group", key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW()
WHERE TRIM(COALESCE(settings.value, '')) = '';
