-- Ensure every supported short-cadence crypto series has an enabled live chart.
WITH crypto_assets (
  series_prefix,
  hourly_series_prefix,
  symbol,
  display_name,
  display_symbol,
  line_color,
  icon_path
) AS (
  VALUES
    ('bnb', 'bnb', 'bnb/usd', 'BNB', 'BNB/USD', '#F0B90B', '/images/live-assets/bnb.svg'),
    ('btc', 'btc', 'btc/usd', 'Bitcoin', 'BTC/USD', '#FF9900', '/images/live-assets/btc.svg'),
    ('doge', 'doge', 'doge/usd', 'Dogecoin', 'DOGE/USD', '#C2A633', '/images/live-assets/doge.svg'),
    ('eth', 'eth', 'eth/usd', 'Ethereum', 'ETH/USD', '#637FEB', '/images/live-assets/eth.svg'),
    ('hype', 'hype', 'hype/usd', 'HYPE', 'HYPE/USD', '#00C2A8', '/images/live-assets/hype.svg'),
    ('sol', 'solana', 'sol/usd', 'Solana', 'SOL/USD', '#9945FF', '/images/live-assets/sol.svg'),
    ('xrp', 'xrp', 'xrp/usd', 'XRP', 'XRP/USD', '#028CFF', '/images/live-assets/xrp.svg')
),
crypto_cadences (series_suffix, active_window_minutes) AS (
  VALUES
    ('5m', 5),
    ('15m', 15),
    ('hourly', 60),
    ('4h', 240)
)
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
SELECT
  CONCAT(
    CASE
      WHEN crypto_cadences.series_suffix = 'hourly' THEN crypto_assets.hourly_series_prefix
      ELSE crypto_assets.series_prefix
    END,
    '-up-or-down-',
    crypto_cadences.series_suffix
  ),
  'crypto_prices_chainlink',
  'update',
  crypto_assets.symbol,
  crypto_assets.display_name,
  crypto_assets.display_symbol,
  crypto_assets.line_color,
  crypto_assets.icon_path,
  TRUE,
  FALSE,
  crypto_cadences.active_window_minutes
FROM crypto_assets
CROSS JOIN crypto_cadences
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
