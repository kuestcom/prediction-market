-- table: affiliate_referrals
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    user_id character(26) NOT NULL,
    affiliate_user_id character(26) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- constraint: affiliate_referrals affiliate_referrals_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_referrals_pkey'
      AND conrelid = 'public.affiliate_referrals'::regclass
  ) THEN
    ALTER TABLE ONLY public.affiliate_referrals
        ADD CONSTRAINT affiliate_referrals_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: affiliate_referrals affiliate_referrals_user_id_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_referrals_user_id_key'
      AND conrelid = 'public.affiliate_referrals'::regclass
  ) THEN
    ALTER TABLE ONLY public.affiliate_referrals
        ADD CONSTRAINT affiliate_referrals_user_id_key UNIQUE (user_id);
  END IF;
END
$migration$;

-- fk constraint: affiliate_referrals affiliate_referrals_affiliate_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_referrals_affiliate_user_id_fkey'
      AND conrelid = 'public.affiliate_referrals'::regclass
  ) THEN
    ALTER TABLE ONLY public.affiliate_referrals
        ADD CONSTRAINT affiliate_referrals_affiliate_user_id_fkey FOREIGN KEY (affiliate_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: affiliate_referrals affiliate_referrals_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_referrals_user_id_fkey'
      AND conrelid = 'public.affiliate_referrals'::regclass
  ) THEN
    ALTER TABLE ONLY public.affiliate_referrals
        ADD CONSTRAINT affiliate_referrals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_affiliate_referrals_affiliate_user_id
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_user_id ON public.affiliate_referrals USING btree (affiliate_user_id);

-- function: get_affiliate_overview()
CREATE OR REPLACE FUNCTION public.get_affiliate_overview() RETURNS TABLE(affiliate_user_id character, total_referrals bigint, volume numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
SELECT u.id                            AS affiliate_user_id,
       COALESCE(ar.count_referrals, 0) AS total_referrals,
       COALESCE(ord.volume, 0)         AS volume
FROM users u
       LEFT JOIN (SELECT affiliate_user_id, COUNT(*) AS count_referrals
                  FROM affiliate_referrals
                  GROUP BY affiliate_user_id) ar ON ar.affiliate_user_id = u.id
       LEFT JOIN (SELECT affiliate_user_id,
                         SUM(maker_amount) AS volume
                  FROM orders
                  WHERE affiliate_user_id IS NOT NULL
                  GROUP BY affiliate_user_id) ord ON ord.affiliate_user_id = u.id
WHERE ar.count_referrals IS NOT NULL
   OR ord.volume IS NOT NULL
ORDER BY COALESCE(ord.volume, 0) DESC
LIMIT 100;
$$;

-- function: get_affiliate_stats(character)
CREATE OR REPLACE FUNCTION public.get_affiliate_stats(target_user_id character) RETURNS TABLE(total_referrals bigint, active_referrals bigint, volume numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
SELECT COALESCE((SELECT COUNT(*) FROM affiliate_referrals ar WHERE ar.affiliate_user_id = target_user_id),
                0)                                               AS total_referrals,
       COALESCE((SELECT COUNT(DISTINCT o.user_id)
                 FROM orders o
                 WHERE o.affiliate_user_id = target_user_id), 0) AS active_referrals,
       COALESCE((SELECT SUM(o.maker_amount)
                 FROM orders o
                 WHERE o.affiliate_user_id = target_user_id), 0) AS volume;
$$;

-- row security: affiliate_referrals
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- policy: affiliate_referrals service_role_all_affiliate_referrals
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'affiliate_referrals'
      AND policyname = 'service_role_all_affiliate_referrals'
  ) THEN
    CREATE POLICY service_role_all_affiliate_referrals ON public.affiliate_referrals TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

INSERT INTO public.settings ("group", key, value)
VALUES ('affiliate', 'affiliate_share_bps', '5000')
ON CONFLICT ("group", key) DO NOTHING;
