-- table: home_featured_event_context_items
CREATE TABLE IF NOT EXISTS public.home_featured_event_context_items (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    featured_event_id character(26) NOT NULL,
    event_id character(26) NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    item_type text DEFAULT 'news'::text NOT NULL,
    source text NOT NULL,
    title text NOT NULL,
    url text,
    favicon_url text,
    published_at timestamp with time zone,
    relevance_score numeric(8,4),
    is_manual boolean DEFAULT false NOT NULL,
    selected_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_featured_event_context_items_item_type_check CHECK ((item_type = ANY (ARRAY['news'::text, 'comment'::text]))),
    CONSTRAINT home_featured_event_context_items_relevance_score_check CHECK (((relevance_score IS NULL) OR ((relevance_score >= (0)::numeric) AND (relevance_score <= (1)::numeric))))
);

-- table: home_featured_events
CREATE TABLE IF NOT EXISTS public.home_featured_events (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    target_type text DEFAULT 'event'::text NOT NULL,
    event_id character(26),
    series_slug text,
    enabled boolean DEFAULT true NOT NULL,
    rank integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    context_mode text DEFAULT 'auto'::text NOT NULL,
    auto_rollover_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_featured_events_target_reference_check CHECK ((((target_type = 'event'::text) AND (event_id IS NOT NULL) AND (series_slug IS NULL)) OR ((target_type = 'series'::text) AND (event_id IS NULL) AND (TRIM(BOTH FROM COALESCE(series_slug, ''::text)) <> ''::text)))),
    CONSTRAINT home_featured_events_context_mode_check CHECK ((context_mode = ANY (ARRAY['auto'::text, 'news'::text, 'comments'::text, 'hidden'::text]))),
    CONSTRAINT home_featured_events_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ai'::text]))),
    CONSTRAINT home_featured_events_target_type_check CHECK ((target_type = ANY (ARRAY['event'::text, 'series'::text])))
);

-- align the constraint name on databases created from the pre-rebaseline schema
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_events_check'
      AND conrelid = 'public.home_featured_events'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_events_target_reference_check'
      AND conrelid = 'public.home_featured_events'::regclass
  ) THEN
    ALTER TABLE public.home_featured_events
      RENAME CONSTRAINT home_featured_events_check TO home_featured_events_target_reference_check;
  END IF;
END
$migration$;

-- constraint: home_featured_event_context_items home_featured_event_context_items_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_event_context_items_pkey'
      AND conrelid = 'public.home_featured_event_context_items'::regclass
  ) THEN
    ALTER TABLE ONLY public.home_featured_event_context_items
        ADD CONSTRAINT home_featured_event_context_items_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: home_featured_events home_featured_events_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_events_pkey'
      AND conrelid = 'public.home_featured_events'::regclass
  ) THEN
    ALTER TABLE ONLY public.home_featured_events
        ADD CONSTRAINT home_featured_events_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- fk constraint: home_featured_event_context_items home_featured_event_context_items_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_event_context_items_event_id_fkey'
      AND conrelid = 'public.home_featured_event_context_items'::regclass
  ) THEN
    ALTER TABLE ONLY public.home_featured_event_context_items
        ADD CONSTRAINT home_featured_event_context_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: home_featured_event_context_items home_featured_event_context_items_featured_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_event_context_items_featured_event_id_fkey'
      AND conrelid = 'public.home_featured_event_context_items'::regclass
  ) THEN
    ALTER TABLE ONLY public.home_featured_event_context_items
        ADD CONSTRAINT home_featured_event_context_items_featured_event_id_fkey FOREIGN KEY (featured_event_id) REFERENCES public.home_featured_events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: home_featured_events home_featured_events_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'home_featured_events_event_id_fkey'
      AND conrelid = 'public.home_featured_events'::regclass
  ) THEN
    ALTER TABLE ONLY public.home_featured_events
        ADD CONSTRAINT home_featured_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_home_featured_context_event_locale_expires
CREATE INDEX IF NOT EXISTS idx_home_featured_context_event_locale_expires ON public.home_featured_event_context_items USING btree (event_id, locale, expires_at);

-- index: idx_home_featured_context_expires_at
CREATE INDEX IF NOT EXISTS idx_home_featured_context_expires_at ON public.home_featured_event_context_items USING btree (expires_at);

-- index: idx_home_featured_context_featured_locale
CREATE INDEX IF NOT EXISTS idx_home_featured_context_featured_locale ON public.home_featured_event_context_items USING btree (featured_event_id, locale);

-- index: idx_home_featured_events_enabled_rank
CREATE INDEX IF NOT EXISTS idx_home_featured_events_enabled_rank ON public.home_featured_events USING btree (enabled, rank);

-- index: idx_home_featured_events_ends_at
CREATE INDEX IF NOT EXISTS idx_home_featured_events_ends_at ON public.home_featured_events USING btree (ends_at);

-- index: idx_home_featured_events_event_id
CREATE INDEX IF NOT EXISTS idx_home_featured_events_event_id ON public.home_featured_events USING btree (event_id);

-- index: idx_home_featured_events_series_slug
CREATE INDEX IF NOT EXISTS idx_home_featured_events_series_slug ON public.home_featured_events USING btree (series_slug);

-- index: idx_home_featured_events_starts_at
CREATE INDEX IF NOT EXISTS idx_home_featured_events_starts_at ON public.home_featured_events USING btree (starts_at);

-- trigger: home_featured_event_context_items set_home_featured_event_context_items_updated_at
CREATE OR REPLACE TRIGGER set_home_featured_event_context_items_updated_at BEFORE UPDATE ON public.home_featured_event_context_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: home_featured_events set_home_featured_events_updated_at
CREATE OR REPLACE TRIGGER set_home_featured_events_updated_at BEFORE UPDATE ON public.home_featured_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- row security: home_featured_event_context_items
ALTER TABLE public.home_featured_event_context_items ENABLE ROW LEVEL SECURITY;

-- row security: home_featured_events
ALTER TABLE public.home_featured_events ENABLE ROW LEVEL SECURITY;

-- policy: home_featured_event_context_items service_role_all_home_featured_event_context_items
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'home_featured_event_context_items'
      AND policyname = 'service_role_all_home_featured_event_context_items'
  ) THEN
    CREATE POLICY service_role_all_home_featured_event_context_items ON public.home_featured_event_context_items TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: home_featured_events service_role_all_home_featured_events
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'home_featured_events'
      AND policyname = 'service_role_all_home_featured_events'
  ) THEN
    CREATE POLICY service_role_all_home_featured_events ON public.home_featured_events TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

INSERT INTO public.settings ("group", key, value)
VALUES (
  'home_featured',
  'side_card_slides_v1',
  '[{"id":"legacy","enabled":true,"type":"text","title":"Market pulse","text":"Fast movers across active markets.","ctaLabel":"","ctaHref":"","icon":"trending-up","useAi":false,"useImage":false,"imagePath":"","videoUrl":""}]'
)
ON CONFLICT ("group", key) DO NOTHING;
