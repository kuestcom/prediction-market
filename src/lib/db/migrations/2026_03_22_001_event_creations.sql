-- ===========================================
-- Event creations drafts and schedules
-- ===========================================

CREATE TABLE IF NOT EXISTS event_creations (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  source_event_id CHAR(26) REFERENCES events(id) ON DELETE SET NULL ON UPDATE CASCADE,
  deployed_event_id CHAR(26) REFERENCES events(id) ON DELETE SET NULL ON UPDATE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled draft',
  slug TEXT,
  title_template TEXT,
  slug_template TEXT,
  creation_mode TEXT NOT NULL DEFAULT 'single',
  status TEXT NOT NULL DEFAULT 'draft',
  start_at TIMESTAMPTZ,
  deploy_at TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  wallet_address CHAR(42),
  draft_payload JSONB,
  asset_payload JSONB,
  main_category_slug TEXT,
  category_slugs TEXT[] NOT NULL DEFAULT '{}'::text[],
  market_mode TEXT,
  binary_question TEXT,
  binary_outcome_yes TEXT,
  binary_outcome_no TEXT,
  resolution_source TEXT,
  resolution_rules TEXT,
  recurrence_unit TEXT,
  recurrence_interval INTEGER,
  recurrence_until TIMESTAMPTZ,
  pending_request_id TEXT,
  pending_payload_hash CHAR(66),
  pending_chain_id INTEGER,
  pending_confirmed_txs JSONB,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_creations_creation_mode_check CHECK (creation_mode IN ('single', 'recurring')),
  CONSTRAINT event_creations_status_check CHECK (status IN ('draft', 'scheduled', 'running', 'deployed', 'failed', 'canceled')),
  CONSTRAINT event_creations_wallet_address_check CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT event_creations_market_mode_check CHECK (market_mode IS NULL OR market_mode IN ('binary', 'multi_multiple', 'multi_unique')),
  CONSTRAINT event_creations_recurrence_unit_check CHECK (
    recurrence_unit IS NULL OR recurrence_unit IN ('minute', 'hour', 'day', 'week', 'month', 'quarter', 'semiannual', 'year')
  ),
  CONSTRAINT event_creations_recurrence_interval_check CHECK (recurrence_interval IS NULL OR recurrence_interval > 0)
);

CREATE INDEX IF NOT EXISTS idx_event_creations_created_by_status
  ON event_creations (created_by_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_creations_status_deploy_at
  ON event_creations (status, deploy_at);

CREATE INDEX IF NOT EXISTS idx_event_creations_start_at
  ON event_creations (start_at);

CREATE INDEX IF NOT EXISTS idx_event_creations_source_event_id
  ON event_creations (source_event_id);

ALTER TABLE event_creations
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_event_creations" ON "event_creations";
CREATE POLICY "service_role_all_event_creations"
  ON "event_creations"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_event_creations_updated_at ON event_creations;
CREATE TRIGGER set_event_creations_updated_at
  BEFORE UPDATE
  ON event_creations
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
