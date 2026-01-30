-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE settings
(
  id         SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "group"    TEXT        NOT NULL,
  key        TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("group", key)
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE settings
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_settings" ON "settings" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. TRIGGERS
-- ===========================================

CREATE TRIGGER set_settings_updated_at
  BEFORE UPDATE
  ON settings
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ===========================================
-- 6. SEED
-- ===========================================

INSERT INTO settings ("group", key, value)
VALUES ('affiliate', 'trade_fee_bps', '200'),
       ('affiliate', 'affiliate_share_bps', '5000')
ON CONFLICT ("group", key) DO NOTHING;

INSERT INTO settings ("group", key, value)
VALUES ('ai', 'openrouter_api_key', ''),
       ('ai', 'openrouter_model', ''),
       ('ai', 'openrouter_enabled', 'false')
ON CONFLICT ("group", key) DO NOTHING;

INSERT INTO settings ("group", key, value)
VALUES ('i18n', 'enabled_locales', '["en","de","es","pt","fr","zh"]')
ON CONFLICT ("group", key) DO NOTHING;
