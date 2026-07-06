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

UPDATE market_sports AS ms
SET sports_source_league_id = es.sports_league_slug
FROM event_sports AS es
WHERE
  ms.event_id = es.event_id
  AND es.sports_league_slug IS NOT NULL
  AND (
    ms.sports_source_league_id IS NULL
    OR ms.sports_source_league_id = ms.sports_event_slug
  );

UPDATE market_sports AS ms
SET sports_source_league_id = NULL
WHERE
  ms.sports_source_league_id = ms.sports_event_slug
  AND NOT EXISTS (
    SELECT 1
    FROM event_sports AS es
    WHERE
      es.event_id = ms.event_id
      AND es.sports_league_slug IS NOT NULL
  );
