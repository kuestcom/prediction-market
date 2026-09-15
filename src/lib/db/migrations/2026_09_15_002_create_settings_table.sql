-- table: settings
CREATE TABLE IF NOT EXISTS public.settings (
    id smallint NOT NULL,
    "group" text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- sequence: settings_id_seq
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings'
      AND column_name = 'id'
      AND is_identity = 'NO'
  ) THEN
    ALTER TABLE public.settings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.settings_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$migration$;

-- constraint: settings settings_group_key_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'settings_group_key_key'
      AND conrelid = 'public.settings'::regclass
  ) THEN
    ALTER TABLE ONLY public.settings
        ADD CONSTRAINT settings_group_key_key UNIQUE ("group", key);
  END IF;
END
$migration$;

-- constraint: settings settings_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'settings_pkey'
      AND conrelid = 'public.settings'::regclass
  ) THEN
    ALTER TABLE ONLY public.settings
        ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- function: set_settings_updated_at()
CREATE OR REPLACE FUNCTION public.set_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RETURN NEW;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- trigger: settings set_settings_updated_at
CREATE OR REPLACE TRIGGER set_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_settings_updated_at();

-- row security: settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- policy: settings service_role_all_settings
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'settings'
      AND policyname = 'service_role_all_settings'
  ) THEN
    CREATE POLICY service_role_all_settings ON public.settings TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

INSERT INTO public.settings ("group", key, value)
VALUES
  ('ai', 'openrouter_api_key', ''),
  ('ai', 'openrouter_model', ''),
  ('ai', 'openrouter_enabled', 'false'),
  ('i18n', 'enabled_locales', '["en","de","es","pt","fr","zh","ja","ar","ru","it","pl","ko"]')
ON CONFLICT ("group", key) DO NOTHING;
