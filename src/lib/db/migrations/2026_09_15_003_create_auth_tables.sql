-- table: accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id character(26) NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    issuer text
);

-- table: sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    ip_address text,
    user_agent text,
    user_id character(26) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: two_factors
CREATE TABLE IF NOT EXISTS public.two_factors (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    secret text,
    backup_codes text,
    user_id character(26) NOT NULL,
    verified boolean DEFAULT true NOT NULL,
    failed_verification_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone
);

-- table: users
CREATE TABLE IF NOT EXISTS public.users (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    address text NOT NULL,
    username text,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    image text,
    settings jsonb DEFAULT '{"trading": {"market_order_type": "FAK", "show_slippage_warning": false}, "notifications": {"email_resolutions": true, "inapp_order_fills": true, "inapp_resolutions": true, "inapp_hide_small_fills": true}}'::jsonb NOT NULL,
    deposit_wallet_address text,
    deposit_wallet_signature text,
    deposit_wallet_signed_at timestamp with time zone,
    deposit_wallet_status text,
    deposit_wallet_tx_hash text,
    affiliate_code text,
    referred_by_user_id character(26),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: verifications
CREATE TABLE IF NOT EXISTS public.verifications (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: wallets
CREATE TABLE IF NOT EXISTS public.wallets (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    user_id character(26) NOT NULL,
    address text NOT NULL,
    chain_id integer NOT NULL,
    is_primary boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- constraint: accounts accounts_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_pkey'
      AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE ONLY public.accounts
        ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: sessions sessions_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_pkey'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE ONLY public.sessions
        ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: sessions sessions_token_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_token_key'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE ONLY public.sessions
        ADD CONSTRAINT sessions_token_key UNIQUE (token);
  END IF;
END
$migration$;

-- constraint: users users_address_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_address_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT users_address_key UNIQUE (address);
  END IF;
END
$migration$;

-- constraint: users users_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_pkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: verifications verifications_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'verifications_pkey'
      AND conrelid = 'public.verifications'::regclass
  ) THEN
    ALTER TABLE ONLY public.verifications
        ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: wallets wallets_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallets_pkey'
      AND conrelid = 'public.wallets'::regclass
  ) THEN
    ALTER TABLE ONLY public.wallets
        ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- fk constraint: accounts accounts_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_user_id_fkey'
      AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE ONLY public.accounts
        ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: sessions sessions_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_user_id_fkey'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE ONLY public.sessions
        ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: two_factors two_factors_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'two_factors_user_id_fkey'
      AND conrelid = 'public.two_factors'::regclass
  ) THEN
    ALTER TABLE ONLY public.two_factors
        ADD CONSTRAINT two_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: users users_referred_by_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_referred_by_user_id_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT users_referred_by_user_id_fkey FOREIGN KEY (referred_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$migration$;

-- fk constraint: wallets wallets_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallets_user_id_fkey'
      AND conrelid = 'public.wallets'::regclass
  ) THEN
    ALTER TABLE ONLY public.wallets
        ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_accounts_issuer_account_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_issuer_account_id ON public.accounts USING btree (issuer, account_id);

-- index: idx_accounts_user_id
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts USING btree (user_id);

-- index: idx_sessions_user_id
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions USING btree (user_id);

-- index: idx_two_factors_user_id
CREATE INDEX IF NOT EXISTS idx_two_factors_user_id ON public.two_factors USING btree (user_id);

-- index: idx_users_address
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_address ON public.users USING btree (lower(address));

-- index: idx_users_affiliate_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_affiliate_code ON public.users USING btree (lower(affiliate_code));

-- index: idx_users_deposit_wallet_address
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_deposit_wallet_address ON public.users USING btree (lower(deposit_wallet_address));

-- index: idx_users_email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (lower(email));

-- index: idx_users_referred_by_user_id
CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON public.users USING btree (referred_by_user_id);

-- index: idx_users_username
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (lower(username));

-- index: idx_users_username_lower_gin_trgm
CREATE INDEX IF NOT EXISTS idx_users_username_lower_gin_trgm ON public.users USING gin (lower(username) extensions.gin_trgm_ops);

-- index: idx_verifications_identifier
CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON public.verifications USING btree (identifier);

-- index: idx_wallets_user_id
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets USING btree (user_id);

-- trigger: accounts set_accounts_updated_at
CREATE OR REPLACE TRIGGER set_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: sessions set_sessions_updated_at
CREATE OR REPLACE TRIGGER set_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: users set_users_updated_at
CREATE OR REPLACE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: verifications set_verifications_updated_at
CREATE OR REPLACE TRIGGER set_verifications_updated_at BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- row security: accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- row security: sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- row security: two_factors
ALTER TABLE public.two_factors ENABLE ROW LEVEL SECURITY;

-- row security: users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- row security: verifications
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- row security: wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- policy: accounts service_role_all_accounts
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounts'
      AND policyname = 'service_role_all_accounts'
  ) THEN
    CREATE POLICY service_role_all_accounts ON public.accounts TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: sessions service_role_all_sessions
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sessions'
      AND policyname = 'service_role_all_sessions'
  ) THEN
    CREATE POLICY service_role_all_sessions ON public.sessions TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: two_factors service_role_all_two_factors
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'two_factors'
      AND policyname = 'service_role_all_two_factors'
  ) THEN
    CREATE POLICY service_role_all_two_factors ON public.two_factors TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: users service_role_all_users
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'service_role_all_users'
  ) THEN
    CREATE POLICY service_role_all_users ON public.users TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: verifications service_role_all_verifications
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verifications'
      AND policyname = 'service_role_all_verifications'
  ) THEN
    CREATE POLICY service_role_all_verifications ON public.verifications TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: wallets service_role_all_wallets
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallets'
      AND policyname = 'service_role_all_wallets'
  ) THEN
    CREATE POLICY service_role_all_wallets ON public.wallets TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;
