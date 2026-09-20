-- table: decision_model_search_rate_limits
CREATE TABLE IF NOT EXISTS public.decision_model_search_rate_limits (
    user_id text NOT NULL,
    window_started_at timestamp with time zone DEFAULT now() NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- constraint: decision_model_search_rate_limits decision_model_search_rate_limits_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'decision_model_search_rate_limits_pkey'
      AND conrelid = 'public.decision_model_search_rate_limits'::regclass
  ) THEN
    ALTER TABLE ONLY public.decision_model_search_rate_limits
        ADD CONSTRAINT decision_model_search_rate_limits_pkey PRIMARY KEY (user_id);
  END IF;
END
$migration$;

-- fk constraint: decision_model_search_rate_limits decision_model_search_rate_limits_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'decision_model_search_rate_limits_user_id_fkey'
      AND conrelid = 'public.decision_model_search_rate_limits'::regclass
  ) THEN
    ALTER TABLE ONLY public.decision_model_search_rate_limits
        ADD CONSTRAINT decision_model_search_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$migration$;

-- trigger: decision_model_search_rate_limits set_decision_model_search_rate_limits_updated_at
CREATE OR REPLACE TRIGGER set_decision_model_search_rate_limits_updated_at
BEFORE UPDATE ON public.decision_model_search_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- row security: decision_model_search_rate_limits
ALTER TABLE public.decision_model_search_rate_limits ENABLE ROW LEVEL SECURITY;

-- policy: decision_model_search_rate_limits service_role_all_decision_model_search_rate_limits
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_model_search_rate_limits'
      AND policyname = 'service_role_all_decision_model_search_rate_limits'
  ) THEN
    CREATE POLICY service_role_all_decision_model_search_rate_limits
      ON public.decision_model_search_rate_limits
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$migration$;
