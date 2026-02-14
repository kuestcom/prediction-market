-- Ensure the initial Meta live chart config uses the equity stream symbol format.
INSERT INTO event_live_chart_configs (
  series_slug,
  topic,
  event_type,
  symbol,
  display_name,
  display_symbol,
  line_color,
  icon_path,
  enabled
)
VALUES (
  'meta-daily-up-down',
  'equity_prices',
  'update',
  'META',
  'Meta',
  'META',
  '#0866FF',
  '/images/live-assets/meta.svg',
  TRUE
)
ON CONFLICT (series_slug) DO UPDATE
SET
  topic = EXCLUDED.topic,
  event_type = EXCLUDED.event_type,
  symbol = EXCLUDED.symbol,
  display_name = EXCLUDED.display_name,
  display_symbol = EXCLUDED.display_symbol,
  line_color = EXCLUDED.line_color,
  icon_path = EXCLUDED.icon_path,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
