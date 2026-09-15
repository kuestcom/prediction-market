-- table: allowed_market_creators
CREATE TABLE IF NOT EXISTS public.allowed_market_creators (
    wallet_address text NOT NULL,
    display_name text NOT NULL,
    source_url text,
    source_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT allowed_market_creators_source_type_check CHECK ((source_type = ANY (ARRAY['site'::text, 'wallet'::text]))),
    CONSTRAINT allowed_market_creators_source_url_check CHECK ((((source_type = 'site'::text) AND (source_url IS NOT NULL)) OR ((source_type = 'wallet'::text) AND (source_url IS NULL)))),
    CONSTRAINT allowed_market_creators_wallet_address_check CHECK ((wallet_address ~ '^0x[0-9a-f]{40}$'::text))
);

-- table: event_creations
CREATE TABLE IF NOT EXISTS public.event_creations (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    created_by_user_id text NOT NULL,
    updated_by_user_id text,
    source_event_id character(26),
    deployed_event_id character(26),
    title text DEFAULT 'Untitled draft'::text NOT NULL,
    slug text,
    title_template text,
    slug_template text,
    creation_mode text DEFAULT 'single'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    start_at timestamp with time zone,
    deploy_at timestamp with time zone,
    end_date timestamp with time zone,
    wallet_address character(42),
    draft_payload jsonb,
    asset_payload jsonb,
    main_category_slug text,
    category_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    market_mode text,
    binary_question text,
    binary_outcome_yes text,
    binary_outcome_no text,
    resolution_source text,
    resolution_rules text,
    recurrence_unit text,
    recurrence_interval integer,
    recurrence_until timestamp with time zone,
    pending_request_id text,
    pending_payload_hash character(66),
    pending_chain_id integer,
    pending_confirmed_txs jsonb,
    last_run_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_creations_creation_mode_check CHECK ((creation_mode = ANY (ARRAY['single'::text, 'recurring'::text]))),
    CONSTRAINT event_creations_market_mode_check CHECK (((market_mode IS NULL) OR (market_mode = ANY (ARRAY['binary'::text, 'multi_multiple'::text, 'multi_unique'::text])))),
    CONSTRAINT event_creations_recurrence_interval_check CHECK (((recurrence_interval IS NULL) OR (recurrence_interval > 0))),
    CONSTRAINT event_creations_recurrence_unit_check CHECK (((recurrence_unit IS NULL) OR (recurrence_unit = ANY (ARRAY['minute'::text, 'hour'::text, 'day'::text, 'week'::text, 'month'::text, 'quarter'::text, 'semiannual'::text, 'year'::text])))),
    CONSTRAINT event_creations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'running'::text, 'deployed'::text, 'failed'::text, 'canceled'::text]))),
    CONSTRAINT event_creations_wallet_address_check CHECK (((wallet_address IS NULL) OR (wallet_address ~ '^0x[0-9a-f]{40}$'::text)))
);

-- constraint: allowed_market_creators allowed_market_creators_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'allowed_market_creators_pkey'
      AND conrelid = 'public.allowed_market_creators'::regclass
  ) THEN
    ALTER TABLE ONLY public.allowed_market_creators
        ADD CONSTRAINT allowed_market_creators_pkey PRIMARY KEY (wallet_address);
  END IF;
END
$migration$;

-- constraint: event_creations event_creations_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_creations_pkey'
      AND conrelid = 'public.event_creations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_creations
        ADD CONSTRAINT event_creations_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- fk constraint: event_creations event_creations_created_by_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_creations_created_by_user_id_fkey'
      AND conrelid = 'public.event_creations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_creations
        ADD CONSTRAINT event_creations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: event_creations event_creations_deployed_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_creations_deployed_event_id_fkey'
      AND conrelid = 'public.event_creations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_creations
        ADD CONSTRAINT event_creations_deployed_event_id_fkey FOREIGN KEY (deployed_event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END
$migration$;

-- fk constraint: event_creations event_creations_source_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_creations_source_event_id_fkey'
      AND conrelid = 'public.event_creations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_creations
        ADD CONSTRAINT event_creations_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END
$migration$;

-- fk constraint: event_creations event_creations_updated_by_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_creations_updated_by_user_id_fkey'
      AND conrelid = 'public.event_creations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_creations
        ADD CONSTRAINT event_creations_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END
$migration$;

-- index: idx_allowed_market_creators_source_type
CREATE INDEX IF NOT EXISTS idx_allowed_market_creators_source_type ON public.allowed_market_creators USING btree (source_type);

-- index: idx_allowed_market_creators_source_url
CREATE INDEX IF NOT EXISTS idx_allowed_market_creators_source_url ON public.allowed_market_creators USING btree (source_url);

-- index: idx_event_creations_created_by_status
CREATE INDEX IF NOT EXISTS idx_event_creations_created_by_status ON public.event_creations USING btree (created_by_user_id, status, updated_at DESC);

-- index: idx_event_creations_deployed_event_id
CREATE INDEX IF NOT EXISTS idx_event_creations_deployed_event_id ON public.event_creations USING btree (deployed_event_id);

-- index: idx_event_creations_source_event_id
CREATE INDEX IF NOT EXISTS idx_event_creations_source_event_id ON public.event_creations USING btree (source_event_id);

-- index: idx_event_creations_start_at
CREATE INDEX IF NOT EXISTS idx_event_creations_start_at ON public.event_creations USING btree (start_at);

-- index: idx_event_creations_status_deploy_at
CREATE INDEX IF NOT EXISTS idx_event_creations_status_deploy_at ON public.event_creations USING btree (status, deploy_at);

-- index: idx_event_creations_updated_by_user_id
CREATE INDEX IF NOT EXISTS idx_event_creations_updated_by_user_id ON public.event_creations USING btree (updated_by_user_id);

-- trigger: allowed_market_creators set_allowed_market_creators_updated_at
CREATE OR REPLACE TRIGGER set_allowed_market_creators_updated_at BEFORE UPDATE ON public.allowed_market_creators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: event_creations set_event_creations_updated_at
CREATE OR REPLACE TRIGGER set_event_creations_updated_at BEFORE UPDATE ON public.event_creations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- row security: allowed_market_creators
ALTER TABLE public.allowed_market_creators ENABLE ROW LEVEL SECURITY;

-- row security: event_creations
ALTER TABLE public.event_creations ENABLE ROW LEVEL SECURITY;

-- policy: allowed_market_creators service_role_all_allowed_market_creators
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'allowed_market_creators'
      AND policyname = 'service_role_all_allowed_market_creators'
  ) THEN
    CREATE POLICY service_role_all_allowed_market_creators ON public.allowed_market_creators TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: event_creations service_role_all_event_creations
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_creations'
      AND policyname = 'service_role_all_event_creations'
  ) THEN
    CREATE POLICY service_role_all_event_creations ON public.event_creations TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

INSERT INTO public.allowed_market_creators (
  wallet_address,
  display_name,
  source_url,
  source_type
)
VALUES (
  '0x183d590c4d7f74b11f265ff131bfe3259a25969b',
  'demo.kuest.com',
  'https://demo.kuest.com',
  'site'
)
ON CONFLICT (wallet_address) DO NOTHING;

INSERT INTO public.settings ("group", key, value)
VALUES
  ('admin_onboarding', 'brand', 'false'),
  ('admin_onboarding', 'fee-wallet', 'false'),
  ('admin_onboarding', 'openrouter', 'false'),
  ('admin_onboarding', 'endpoints', 'false'),
  ('integrations', 'kuest_support_enabled', 'true'),
  ('integrations', 'kuest_support_position', 'right'),
  ('admin_support', 'announcement_dismissed_at', '')
ON CONFLICT ("group", key) DO NOTHING;
