CREATE INDEX IF NOT EXISTS idx_markets_condition_id_lower
  ON markets (LOWER(condition_id));
