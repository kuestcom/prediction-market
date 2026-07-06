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
