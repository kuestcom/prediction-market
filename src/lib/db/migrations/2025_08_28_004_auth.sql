-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE users
(
  id                     CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  address                TEXT        NOT NULL UNIQUE,
  username               TEXT,
  email                  TEXT        NOT NULL,
  email_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
  two_factor_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  image                  TEXT,
  settings               JSONB       NOT NULL DEFAULT '{
    "trading": {
      "market_order_type": "FAK",
      "show_slippage_warning": false
    },
    "notifications": {
      "email_resolutions": true,
      "inapp_order_fills": true,
      "inapp_resolutions": true,
      "inapp_hide_small_fills": true
    }
  }'::jsonb,
  proxy_wallet_address   TEXT,
  proxy_wallet_signature TEXT,
  proxy_wallet_signed_at TIMESTAMPTZ,
  proxy_wallet_status    TEXT        NOT NULL DEFAULT 'not_started',
  proxy_wallet_tx_hash   TEXT,
  affiliate_code         TEXT,
  referred_by_user_id    CHAR(26)    REFERENCES users (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions
(
  id         CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  expires_at TIMESTAMPTZ NOT NULL,
  token      TEXT        NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  user_id    CHAR(26)    NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts
(
  id                       CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  account_id               TEXT        NOT NULL,
  provider_id              TEXT        NOT NULL,
  user_id                  CHAR(26)    NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  access_token             TEXT,
  refresh_token            TEXT,
  id_token                 TEXT,
  access_token_expires_at  TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope                    TEXT,
  password                 TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE verifications
(
  id         CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  identifier TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wallets
(
  id         CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id    CHAR(26)    NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  address    TEXT        NOT NULL,
  chain_id   INTEGER     NOT NULL,
  is_primary BOOLEAN     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE two_factors
(
  id           CHAR(26) NOT NULL DEFAULT generate_ulid(),
  secret       TEXT,
  backup_codes TEXT,
  user_id      CHAR(26) NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

CREATE UNIQUE INDEX idx_users_email ON users (LOWER(email));
CREATE UNIQUE INDEX idx_users_username ON users (LOWER(username));
CREATE UNIQUE INDEX idx_users_address ON users (LOWER(address));
CREATE UNIQUE INDEX idx_users_proxy_wallet_address ON users (LOWER(proxy_wallet_address));
CREATE UNIQUE INDEX idx_users_affiliate_code ON users (LOWER(affiliate_code));
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_accounts_user_id ON accounts (user_id);
CREATE INDEX idx_verifications_identifier ON verifications (identifier);
CREATE INDEX idx_wallets_user_id ON wallets (user_id);
CREATE INDEX idx_two_factors_user_id ON two_factors (user_id);

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE users
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factors
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_accounts" ON "accounts" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_sessions" ON "sessions" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_two_factors" ON "two_factors" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_users" ON "users" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_verifications" ON "verifications" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_wallets" ON "wallets" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. TRIGGERS
-- ===========================================

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE
  ON users
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE
  ON sessions
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE
  ON accounts
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_verifications_updated_at
  BEFORE UPDATE
  ON verifications
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
