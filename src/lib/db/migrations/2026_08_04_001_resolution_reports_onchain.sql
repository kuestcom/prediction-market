ALTER TABLE market_resolution_reports
  ADD COLUMN IF NOT EXISTS managed_request_id CHAR(66),
  ADD COLUMN IF NOT EXISTS proposal_id NUMERIC(78, 0),
  ADD COLUMN IF NOT EXISTS transaction_hash CHAR(66);

ALTER TABLE market_resolution_reports
  DROP CONSTRAINT IF EXISTS market_resolution_reports_condition_user_key,
  DROP CONSTRAINT IF EXISTS market_resolution_reports_proposed_outcome_check,
  DROP COLUMN IF EXISTS signature,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS signed_at;

ALTER TABLE market_resolution_reports
  ADD CONSTRAINT market_resolution_reports_proposed_outcome_check
    CHECK (proposed_outcome IN ('yes', 'no')) NOT VALID,
  ADD CONSTRAINT market_resolution_reports_managed_request_id_check
    CHECK (managed_request_id IS NULL OR managed_request_id ~ '^0x[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT market_resolution_reports_transaction_hash_check
    CHECK (transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9a-f]{64}$') NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS market_resolution_reports_market_wallet_key
  ON market_resolution_reports (managed_request_id, reporter_address);

CREATE UNIQUE INDEX IF NOT EXISTS market_resolution_reports_proposal_id_key
  ON market_resolution_reports (proposal_id)
  WHERE proposal_id IS NOT NULL;
