-- ===========================================
-- Market context shared cache
-- ===========================================

CREATE TABLE IF NOT EXISTS market_context_cache (
  condition_id TEXT NOT NULL REFERENCES markets (condition_id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale TEXT NOT NULL,
  context TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (condition_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_market_context_cache_expires_at
  ON market_context_cache (expires_at);

ALTER TABLE market_context_cache
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_market_context_cache" ON "market_context_cache";
CREATE POLICY "service_role_all_market_context_cache"
  ON "market_context_cache"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_market_context_cache_updated_at ON market_context_cache;
CREATE TRIGGER set_market_context_cache_updated_at
  BEFORE UPDATE
  ON market_context_cache
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
