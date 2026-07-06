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

UPDATE event_sports
SET
  sports_source_provider = COALESCE(sports_source_provider, 'legacy'),
  sports_source_event_id = COALESCE(sports_source_event_id, sports_event_id),
  sports_source_game_id = COALESCE(sports_source_game_id, sports_game_id::TEXT),
  sports_source_league_label = COALESCE(sports_source_league_label, sports_league_label),
  sports_source_league_id = COALESCE(sports_source_league_id, sports_league_slug),
  sports_source_selected_at = COALESCE(sports_source_selected_at, updated_at, NOW())
WHERE
  sports_source_provider IS NULL
  AND (
    sports_event_id IS NOT NULL
    OR sports_game_id IS NOT NULL
    OR sports_league_label IS NOT NULL
    OR sports_league_slug IS NOT NULL
  );

UPDATE market_sports
SET
  sports_source_provider = COALESCE(sports_source_provider, 'legacy'),
  sports_source_event_id = COALESCE(sports_source_event_id, sports_event_id::TEXT),
  sports_source_game_id = COALESCE(sports_source_game_id, sports_game_id::TEXT)
WHERE
  sports_source_provider IS NULL
  AND (
    sports_event_id IS NOT NULL
    OR sports_game_id IS NOT NULL
  );

UPDATE market_sports AS ms
SET sports_source_league_id = COALESCE(ms.sports_source_league_id, es.sports_league_slug)
FROM event_sports AS es
WHERE
  ms.event_id = es.event_id
  AND ms.sports_source_league_id IS NULL
  AND es.sports_league_slug IS NOT NULL;

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
