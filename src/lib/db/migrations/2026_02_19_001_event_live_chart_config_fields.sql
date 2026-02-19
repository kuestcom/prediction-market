-- Add formatting and active-window controls to live chart series config.
ALTER TABLE event_live_chart_configs
  ADD COLUMN IF NOT EXISTS show_price_decimals BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS active_window_minutes INTEGER NOT NULL DEFAULT 1440;

-- Configure display precision per market family.
-- Equities (NASDAQ-style) keep decimal precision, crypto series stay integer by default.
UPDATE event_live_chart_configs
SET show_price_decimals = CASE
  WHEN topic = 'equity_prices' THEN TRUE
  WHEN topic = 'crypto_prices_chainlink' THEN FALSE
  ELSE show_price_decimals
END;

-- Configure live trading window length (in minutes) by series cadence:
-- 5m => 5, 15m => 15, hourly => 60, 4h => 240, daily => 390 (equities) / 1440 (crypto).
UPDATE event_live_chart_configs
SET active_window_minutes = CASE
  WHEN series_slug ILIKE '%5m%' THEN 5
  WHEN series_slug ILIKE '%15m%' THEN 15
  WHEN series_slug ILIKE '%hourly%' THEN 60
  WHEN series_slug ILIKE '%4h%' THEN 240
  WHEN series_slug ILIKE '%daily%' AND topic = 'equity_prices' THEN 390
  WHEN series_slug ILIKE '%daily%' THEN 1440
  ELSE active_window_minutes
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_live_chart_configs_active_window_minutes_positive'
  ) THEN
    ALTER TABLE event_live_chart_configs
      ADD CONSTRAINT event_live_chart_configs_active_window_minutes_positive
      CHECK (active_window_minutes > 0);
  END IF;
END $$;

COMMENT ON COLUMN event_live_chart_configs.show_price_decimals IS
  'When true, render live chart prices with cents/decimals.';

COMMENT ON COLUMN event_live_chart_configs.active_window_minutes IS
  'How many minutes before event end the market is considered actively trading.';
