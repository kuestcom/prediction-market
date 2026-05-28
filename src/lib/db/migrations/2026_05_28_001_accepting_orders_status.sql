ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_markets_accepting_orders
  ON markets (accepting_orders);

CREATE INDEX IF NOT EXISTS idx_markets_archived
  ON markets (archived);
