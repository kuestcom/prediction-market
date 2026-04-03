ALTER TABLE event_sports
  ADD COLUMN IF NOT EXISTS sports_league_label TEXT;

ALTER TABLE event_sports
  ADD COLUMN IF NOT EXISTS sports_league_slug TEXT;

WITH league_by_event AS (
  SELECT DISTINCT ON (markets.event_id)
    markets.event_id,
    NULLIF(TRIM(COALESCE(markets.metadata::jsonb -> 'event' ->> 'league', '')), '') AS league_label
  FROM markets
  WHERE NULLIF(TRIM(COALESCE(markets.metadata::jsonb -> 'event' ->> 'league', '')), '') IS NOT NULL
  ORDER BY markets.event_id, markets.updated_at DESC NULLS LAST, markets.created_at DESC NULLS LAST
),
normalized_league_by_event AS (
  SELECT
    league_by_event.event_id,
    league_by_event.league_label,
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          LOWER(TRIM(league_by_event.league_label)),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ) AS league_slug
  FROM league_by_event
)
UPDATE event_sports
SET
  sports_league_label = normalized_league_by_event.league_label,
  sports_league_slug = normalized_league_by_event.league_slug,
  updated_at = NOW()
FROM normalized_league_by_event
WHERE event_sports.event_id = normalized_league_by_event.event_id
  AND (
    event_sports.sports_league_label IS DISTINCT FROM normalized_league_by_event.league_label
    OR event_sports.sports_league_slug IS DISTINCT FROM normalized_league_by_event.league_slug
  );

CREATE INDEX IF NOT EXISTS idx_event_sports_league_slug
  ON event_sports (sports_league_slug);

CREATE INDEX IF NOT EXISTS idx_event_sports_event_slug_league_slug
  ON event_sports (sports_event_slug, sports_league_slug);
