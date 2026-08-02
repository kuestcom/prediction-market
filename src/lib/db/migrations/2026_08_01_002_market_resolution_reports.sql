CREATE TABLE IF NOT EXISTS market_resolution_reports (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  condition_id TEXT NOT NULL REFERENCES markets(condition_id) ON DELETE CASCADE ON UPDATE CASCADE,
  event_id CHAR(26) NOT NULL REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  reporter_address CHAR(42) NOT NULL,
  proposed_outcome TEXT NOT NULL,
  signature CHAR(132) NOT NULL,
  nonce TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT market_resolution_reports_condition_user_key UNIQUE (condition_id, user_id),
  CONSTRAINT market_resolution_reports_reporter_address_check
    CHECK (reporter_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT market_resolution_reports_proposed_outcome_check
    CHECK (proposed_outcome IN ('yes', 'no', 'unknown')),
  CONSTRAINT market_resolution_reports_signature_check
    CHECK (signature ~ '^0x[0-9a-f]{130}$')
);

CREATE INDEX IF NOT EXISTS idx_market_resolution_reports_event_created_at
  ON market_resolution_reports (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_resolution_reports_condition_created_at
  ON market_resolution_reports (condition_id, created_at DESC);

ALTER TABLE market_resolution_reports
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_market_resolution_reports" ON market_resolution_reports;
CREATE POLICY "service_role_all_market_resolution_reports"
  ON market_resolution_reports
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_market_resolution_reports_updated_at ON market_resolution_reports;
CREATE TRIGGER set_market_resolution_reports_updated_at
  BEFORE UPDATE
  ON market_resolution_reports
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
