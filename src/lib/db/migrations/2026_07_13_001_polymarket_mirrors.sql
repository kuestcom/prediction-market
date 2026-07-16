ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_polymarket_mirror BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS polymarket_condition_id TEXT;

ALTER TABLE outcomes
  ADD COLUMN IF NOT EXISTS polymarket_token_id TEXT;

CREATE TABLE IF NOT EXISTS arbitrage_order_rate_limits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_arbitrage_order_rate_limits_updated_at ON arbitrage_order_rate_limits;
CREATE TRIGGER set_arbitrage_order_rate_limits_updated_at
  BEFORE UPDATE
  ON arbitrage_order_rate_limits
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO settings ("group", key, value)
VALUES
  ('integrations', 'arbitrage_enabled', 'true'),
  ('integrations', 'arbitrage_multi_wallet_enabled', 'false')
ON CONFLICT ("group", key) DO NOTHING;

UPDATE markets
SET polymarket_condition_id = NULLIF(TRIM(metadata::jsonb ->> 'mirror_condition_id'), '')
WHERE metadata IS NOT NULL
  AND polymarket_condition_id IS NULL
  AND metadata::jsonb ? 'mirror_condition_id';

UPDATE outcomes AS outcome
SET polymarket_token_id = NULLIF(
  TRIM((market.metadata::jsonb -> 'mirror_outcome_token_ids') ->> outcome.outcome_index),
  ''
)
FROM markets AS market
WHERE market.condition_id = outcome.condition_id
  AND market.metadata IS NOT NULL
  AND outcome.polymarket_token_id IS NULL
  AND jsonb_typeof(market.metadata::jsonb -> 'mirror_outcome_token_ids') = 'array';

UPDATE events AS event
SET is_polymarket_mirror = TRUE
WHERE EXISTS (
  SELECT 1
  FROM markets AS market
  WHERE market.event_id = event.id
    AND market.polymarket_condition_id IS NOT NULL
);

UPDATE markets
SET metadata = metadata::jsonb - 'mirror_condition_id' - 'mirror_outcome_token_ids'
WHERE metadata IS NOT NULL
  AND metadata::jsonb ?| ARRAY['mirror_condition_id', 'mirror_outcome_token_ids'];

CREATE INDEX IF NOT EXISTS markets_polymarket_condition_id_idx
  ON markets (polymarket_condition_id)
  WHERE polymarket_condition_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outcomes_polymarket_token_id_idx
  ON outcomes (polymarket_token_id)
  WHERE polymarket_token_id IS NOT NULL;
