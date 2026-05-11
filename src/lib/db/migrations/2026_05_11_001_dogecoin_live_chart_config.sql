-- ===========================================
-- Dogecoin live chart configuration
-- ===========================================

INSERT INTO event_live_chart_configs (
  series_slug,
  topic,
  event_type,
  symbol,
  display_name,
  display_symbol,
  line_color,
  icon_path,
  enabled,
  show_price_decimals,
  active_window_minutes
)
VALUES (
  'dogecoin-up-or-down-daily',
  'crypto_prices_chainlink',
  'update',
  'doge/usd',
  'Dogecoin',
  'DOGE/USD',
  '#C2A633',
  '/images/live-assets/doge.svg',
  TRUE,
  FALSE,
  1440
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
  show_price_decimals = EXCLUDED.show_price_decimals,
  active_window_minutes = EXCLUDED.active_window_minutes,
  updated_at = NOW();
