-- table: jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    job_type text NOT NULL,
    dedupe_key text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    max_attempts smallint DEFAULT 5 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    reserved_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT jobs_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT jobs_max_attempts_check CHECK ((max_attempts > 0)),
    CONSTRAINT jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);

-- table: subgraph_syncs
CREATE TABLE IF NOT EXISTS public.subgraph_syncs (
    id integer NOT NULL,
    service_name text NOT NULL,
    subgraph_name text NOT NULL,
    status text DEFAULT 'idle'::text,
    cursor_updated_at bigint,
    cursor_id text,
    total_processed integer DEFAULT 0,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subgraph_syncs_status_check CHECK ((status = ANY (ARRAY['idle'::text, 'running'::text, 'completed'::text, 'error'::text]))),
    CONSTRAINT subgraph_syncs_total_processed_check CHECK ((total_processed >= 0))
);

-- sequence: subgraph_syncs_id_seq
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subgraph_syncs'
      AND column_name = 'id'
      AND is_identity = 'NO'
  ) THEN
    ALTER TABLE public.subgraph_syncs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.subgraph_syncs_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$migration$;

-- constraint: jobs jobs_job_type_dedupe_key_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_job_type_dedupe_key_key'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE ONLY public.jobs
        ADD CONSTRAINT jobs_job_type_dedupe_key_key UNIQUE (job_type, dedupe_key);
  END IF;
END
$migration$;

-- constraint: jobs jobs_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_pkey'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE ONLY public.jobs
        ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: subgraph_syncs subgraph_syncs_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subgraph_syncs_pkey'
      AND conrelid = 'public.subgraph_syncs'::regclass
  ) THEN
    ALTER TABLE ONLY public.subgraph_syncs
        ADD CONSTRAINT subgraph_syncs_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: subgraph_syncs subgraph_syncs_service_name_subgraph_name_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subgraph_syncs_service_name_subgraph_name_key'
      AND conrelid = 'public.subgraph_syncs'::regclass
  ) THEN
    ALTER TABLE ONLY public.subgraph_syncs
        ADD CONSTRAINT subgraph_syncs_service_name_subgraph_name_key UNIQUE (service_name, subgraph_name);
  END IF;
END
$migration$;

-- index: idx_jobs_job_type_status_available_at
CREATE INDEX IF NOT EXISTS idx_jobs_job_type_status_available_at ON public.jobs USING btree (job_type, status, available_at);

-- index: idx_jobs_status_available_at
CREATE INDEX IF NOT EXISTS idx_jobs_status_available_at ON public.jobs USING btree (status, available_at);

-- index: idx_jobs_status_reserved_at
CREATE INDEX IF NOT EXISTS idx_jobs_status_reserved_at ON public.jobs USING btree (status, reserved_at);

-- index: idx_jobs_status_updated_at
CREATE INDEX IF NOT EXISTS idx_jobs_status_updated_at ON public.jobs USING btree (status, updated_at);

-- trigger: jobs set_jobs_updated_at
CREATE OR REPLACE TRIGGER set_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: subgraph_syncs set_subgraph_syncs_updated_at
CREATE OR REPLACE TRIGGER set_subgraph_syncs_updated_at BEFORE UPDATE ON public.subgraph_syncs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- row security: jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- row security: subgraph_syncs
ALTER TABLE public.subgraph_syncs ENABLE ROW LEVEL SECURITY;

-- policy: jobs service_role_all_jobs
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'service_role_all_jobs'
  ) THEN
    CREATE POLICY service_role_all_jobs ON public.jobs TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: subgraph_syncs service_role_all_subgraph_syncs
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subgraph_syncs'
      AND policyname = 'service_role_all_subgraph_syncs'
  ) THEN
    CREATE POLICY service_role_all_subgraph_syncs ON public.subgraph_syncs TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

INSERT INTO public.subgraph_syncs (
  service_name,
  subgraph_name,
  status,
  total_processed,
  error_message,
  cursor_id
)
VALUES
  ('market_sync', 'pnl', 'idle', 0, NULL, NULL),
  ('resolution_sync', 'resolution', 'idle', 0, NULL, NULL),
  ('volume_sync', 'volume', 'idle', 0, NULL, NULL)
ON CONFLICT (service_name, subgraph_name) DO NOTHING;
