UPDATE event_sports
SET
  sports_source_provider = NULL,
  sports_source_event_id = NULL,
  sports_source_game_id = NULL,
  sports_source_league_id = NULL,
  sports_source_league_label = NULL,
  sports_source_match_confidence = NULL,
  sports_source_payload = NULL,
  sports_source_selected_at = NULL
WHERE LOWER(TRIM(COALESCE(sports_source_provider, ''))) = 'legacy';

UPDATE market_sports
SET
  sports_source_provider = NULL,
  sports_source_event_id = NULL,
  sports_source_game_id = NULL,
  sports_source_league_id = NULL,
  sports_source_league_label = NULL,
  sports_source_market_id = NULL,
  sports_source_match_confidence = NULL,
  sports_source_payload = NULL
WHERE LOWER(TRIM(COALESCE(sports_source_provider, ''))) = 'legacy';
