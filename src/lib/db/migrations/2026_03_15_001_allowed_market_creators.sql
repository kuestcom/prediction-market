-- ===========================================
-- Allowed mirrored market creators
-- ===========================================

CREATE TABLE IF NOT EXISTS allowed_market_creators (
  wallet_address TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT allowed_market_creators_wallet_address_check CHECK (wallet_address ~ '^0x[0-9A-Fa-f]{40}$'),
  CONSTRAINT allowed_market_creators_source_type_check CHECK (source_type IN ('site', 'wallet')),
  CONSTRAINT allowed_market_creators_source_url_check CHECK (
    (source_type = 'site' AND source_url IS NOT NULL)
    OR (source_type = 'wallet' AND source_url IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_allowed_market_creators_source_type
  ON allowed_market_creators (source_type);

CREATE INDEX IF NOT EXISTS idx_allowed_market_creators_source_url
  ON allowed_market_creators (source_url);

ALTER TABLE allowed_market_creators
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_allowed_market_creators" ON "allowed_market_creators";
CREATE POLICY "service_role_all_allowed_market_creators"
  ON "allowed_market_creators"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_allowed_market_creators_updated_at ON allowed_market_creators;
CREATE TRIGGER set_allowed_market_creators_updated_at
  BEFORE UPDATE
  ON allowed_market_creators
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO allowed_market_creators (
  wallet_address,
  display_name,
  source_url,
  source_type
)
VALUES (
  '0x1FD81E09dA67D84f02DB0c0eBabd5a217D1B928d',
  'demo.kuest.com',
  'https://demo.kuest.com',
  'site'
)
ON CONFLICT (wallet_address) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_url = EXCLUDED.source_url,
  source_type = EXCLUDED.source_type,
  updated_at = NOW();
