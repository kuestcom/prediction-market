-- table: arbitrage_order_rate_limits
CREATE TABLE IF NOT EXISTS public.arbitrage_order_rate_limits (
    user_id text NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: orders
CREATE TABLE IF NOT EXISTS public.orders (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    salt numeric(78,0),
    maker text NOT NULL,
    signer text NOT NULL,
    taker text NOT NULL,
    token_id text NOT NULL,
    maker_amount bigint NOT NULL,
    taker_amount bigint NOT NULL,
    expiration bigint NOT NULL,
    nonce bigint NOT NULL,
    fee_rate_bps smallint NOT NULL,
    side smallint NOT NULL,
    signature_type smallint NOT NULL,
    signature text,
    user_id text NOT NULL,
    condition_id text NOT NULL,
    type text NOT NULL,
    affiliate_user_id text,
    clob_order_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_side_check CHECK ((side = ANY (ARRAY[0, 1]))),
    CONSTRAINT orders_type_check CHECK ((type = ANY (ARRAY['FAK'::text, 'FOK'::text, 'GTC'::text, 'GTD'::text])))
);

-- constraint: arbitrage_order_rate_limits arbitrage_order_rate_limits_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'arbitrage_order_rate_limits_pkey'
      AND conrelid = 'public.arbitrage_order_rate_limits'::regclass
  ) THEN
    ALTER TABLE ONLY public.arbitrage_order_rate_limits
        ADD CONSTRAINT arbitrage_order_rate_limits_pkey PRIMARY KEY (user_id);
  END IF;
END
$migration$;

-- constraint: orders orders_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_pkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY public.orders
        ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- fk constraint: arbitrage_order_rate_limits arbitrage_order_rate_limits_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'arbitrage_order_rate_limits_user_id_fkey'
      AND conrelid = 'public.arbitrage_order_rate_limits'::regclass
  ) THEN
    ALTER TABLE ONLY public.arbitrage_order_rate_limits
        ADD CONSTRAINT arbitrage_order_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_orders_condition
CREATE INDEX IF NOT EXISTS idx_orders_condition ON public.orders USING btree (condition_id, token_id);

-- index: idx_orders_created_at
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at);

-- index: idx_orders_user_id
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders USING btree (user_id);

-- trigger: arbitrage_order_rate_limits set_arbitrage_order_rate_limits_updated_at
CREATE OR REPLACE TRIGGER set_arbitrage_order_rate_limits_updated_at BEFORE UPDATE ON public.arbitrage_order_rate_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: orders set_orders_updated_at
CREATE OR REPLACE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- row security: arbitrage_order_rate_limits
ALTER TABLE public.arbitrage_order_rate_limits ENABLE ROW LEVEL SECURITY;

-- row security: orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- policy: arbitrage_order_rate_limits service_role_all_arbitrage_order_rate_limits
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'arbitrage_order_rate_limits'
      AND policyname = 'service_role_all_arbitrage_order_rate_limits'
  ) THEN
    CREATE POLICY service_role_all_arbitrage_order_rate_limits ON public.arbitrage_order_rate_limits TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: orders service_role_all_orders
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'service_role_all_orders'
  ) THEN
    CREATE POLICY service_role_all_orders ON public.orders TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

INSERT INTO public.settings ("group", key, value)
VALUES
  ('integrations', 'arbitrage_enabled', 'true'),
  ('integrations', 'arbitrage_multi_wallet_enabled', 'false')
ON CONFLICT ("group", key) DO NOTHING;
