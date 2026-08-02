UPDATE market_resolution_reports AS report
SET event_id = market.event_id
FROM markets AS market
WHERE market.condition_id = report.condition_id
  AND report.event_id IS DISTINCT FROM market.event_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'markets_condition_event_key'
      AND conrelid = 'markets'::regclass
  ) THEN
    ALTER TABLE markets
      ADD CONSTRAINT markets_condition_event_key UNIQUE (condition_id, event_id);
  END IF;
END
$$;

ALTER TABLE market_resolution_reports
  DROP CONSTRAINT IF EXISTS market_resolution_reports_condition_id_fkey,
  DROP CONSTRAINT IF EXISTS market_resolution_reports_event_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'market_resolution_reports_condition_event_fkey'
      AND conrelid = 'market_resolution_reports'::regclass
  ) THEN
    ALTER TABLE market_resolution_reports
      ADD CONSTRAINT market_resolution_reports_condition_event_fkey
      FOREIGN KEY (condition_id, event_id)
      REFERENCES markets (condition_id, event_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE market_resolution_reports
  ALTER COLUMN signature TYPE TEXT USING RTRIM(signature);

DROP INDEX IF EXISTS idx_market_resolution_reports_event_created_at;
DROP INDEX IF EXISTS idx_market_resolution_reports_condition_created_at;

CREATE INDEX IF NOT EXISTS idx_market_resolution_reports_event_updated_at
  ON market_resolution_reports (event_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_market_resolution_reports_condition_outcome_updated_at
  ON market_resolution_reports (condition_id, proposed_outcome, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_market_resolution_reports_user_id
  ON market_resolution_reports (user_id);
