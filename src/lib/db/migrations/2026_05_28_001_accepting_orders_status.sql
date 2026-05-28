ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_markets_event_accepting_orders_false
  ON markets (event_id)
  WHERE accepting_orders = FALSE;

CREATE INDEX IF NOT EXISTS idx_markets_event_archived_true
  ON markets (event_id)
  WHERE archived = TRUE;
