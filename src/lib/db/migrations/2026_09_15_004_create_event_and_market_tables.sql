-- table: conditions
CREATE TABLE IF NOT EXISTS public.conditions (
    id character(66) NOT NULL,
    oracle character(42) NOT NULL,
    question_id character(66) NOT NULL,
    resolved boolean DEFAULT false,
    uma_request_tx_hash character(66),
    uma_request_log_index integer,
    uma_oracle_address character(42),
    mirror_uma_request_tx_hash character(66),
    mirror_uma_request_log_index integer,
    mirror_uma_oracle_address character(42),
    resolution_status text,
    resolution_flagged boolean,
    resolution_paused boolean,
    resolution_last_update timestamp with time zone,
    resolution_price numeric(20,6),
    resolution_was_disputed boolean,
    resolution_approved boolean,
    resolution_liveness_seconds bigint,
    resolution_deadline_at timestamp with time zone,
    metadata_hash text,
    creator character(42),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: conditions_audit
CREATE TABLE IF NOT EXISTS public.conditions_audit (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    condition_id character(66) NOT NULL,
    old_values jsonb NOT NULL,
    new_values jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: event_live_chart_configs
CREATE TABLE IF NOT EXISTS public.event_live_chart_configs (
    series_slug text NOT NULL,
    topic text DEFAULT 'crypto_prices_chainlink'::text NOT NULL,
    event_type text DEFAULT 'update'::text NOT NULL,
    symbol text NOT NULL,
    display_name text NOT NULL,
    display_symbol text NOT NULL,
    line_color text DEFAULT '#F59E0B'::text NOT NULL,
    icon_path text,
    enabled boolean DEFAULT true NOT NULL,
    show_price_decimals boolean DEFAULT true NOT NULL,
    active_window_minutes integer DEFAULT 1440 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_live_chart_configs_active_window_minutes_positive CHECK ((active_window_minutes > 0))
);

-- table: event_tags
CREATE TABLE IF NOT EXISTS public.event_tags (
    event_id character(26) NOT NULL,
    tag_id smallint NOT NULL
);

-- table: event_translations
CREATE TABLE IF NOT EXISTS public.event_translations (
    event_id character(26) NOT NULL,
    locale text NOT NULL,
    title text NOT NULL,
    source_hash text NOT NULL,
    is_manual boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    additional_context text,
    additional_context_source_hash text,
    additional_context_is_manual boolean DEFAULT false NOT NULL,
    rules text,
    rules_source_hash text,
    rules_is_manual boolean DEFAULT false NOT NULL,
    CONSTRAINT event_translations_locale_check CHECK ((locale <> 'en'::text))
);

-- table: events
CREATE TABLE IF NOT EXISTS public.events (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    creator character(42),
    icon_url text,
    livestream_url text,
    show_market_icons boolean DEFAULT true,
    enable_neg_risk boolean DEFAULT false,
    neg_risk_augmented boolean DEFAULT false,
    neg_risk boolean DEFAULT false,
    neg_risk_market_id character(66),
    series_slug text,
    series_id text,
    series_recurrence text,
    status text DEFAULT 'active'::text NOT NULL,
    rules text,
    active_markets_count integer DEFAULT 0,
    total_markets_count integer DEFAULT 0,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    additional_context text,
    additional_context_updated_at timestamp with time zone,
    is_polymarket_mirror boolean DEFAULT false NOT NULL,
    CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'resolved'::text, 'archived'::text])))
);

-- table: market_context_cache
CREATE TABLE IF NOT EXISTS public.market_context_cache (
    condition_id text NOT NULL,
    locale text NOT NULL,
    context text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table: markets
CREATE TABLE IF NOT EXISTS public.markets (
    condition_id text NOT NULL,
    event_id character(26) NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    short_title text,
    question text,
    market_rules text,
    resolution_source text,
    resolution_source_url text,
    resolver character(42),
    neg_risk boolean DEFAULT false NOT NULL,
    neg_risk_other boolean DEFAULT false NOT NULL,
    neg_risk_market_id character(66),
    neg_risk_request_id character(66),
    metadata_version text,
    metadata_schema text,
    icon_url text,
    is_active boolean DEFAULT true,
    is_resolved boolean DEFAULT false,
    metadata jsonb,
    volume_24h numeric(20,6) DEFAULT 0,
    volume numeric(20,6) DEFAULT 0,
    end_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    polymarket_condition_id text,
    CONSTRAINT markets_volume_24h_check CHECK ((volume_24h >= (0)::numeric)),
    CONSTRAINT markets_volume_check CHECK ((volume >= (0)::numeric))
);

-- table: outcomes
CREATE TABLE IF NOT EXISTS public.outcomes (
    token_id text NOT NULL,
    condition_id character(66) NOT NULL,
    outcome_text text NOT NULL,
    outcome_index smallint NOT NULL,
    is_winning_outcome boolean DEFAULT false,
    payout_value numeric(20,6),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    polymarket_token_id text,
    CONSTRAINT outcomes_outcome_index_check CHECK ((outcome_index >= 0)),
    CONSTRAINT outcomes_payout_value_check CHECK (((payout_value IS NULL) OR (payout_value >= (0)::numeric)))
);

-- table: tag_translations
CREATE TABLE IF NOT EXISTS public.tag_translations (
    tag_id smallint NOT NULL,
    locale text NOT NULL,
    name text NOT NULL,
    source_hash text,
    is_manual boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tag_translations_locale_check CHECK ((locale <> 'en'::text))
);

-- table: tags
CREATE TABLE IF NOT EXISTS public.tags (
    id smallint NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_main_category boolean DEFAULT false,
    is_hidden boolean DEFAULT false NOT NULL,
    hide_events boolean DEFAULT false NOT NULL,
    display_order smallint DEFAULT 0,
    active_markets_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    event_page_note text
);

-- sequence: tags_id_seq
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tags'
      AND column_name = 'id'
      AND is_identity = 'NO'
  ) THEN
    ALTER TABLE public.tags ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.tags_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$migration$;

-- constraint: conditions_audit conditions_audit_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conditions_audit_pkey'
      AND conrelid = 'public.conditions_audit'::regclass
  ) THEN
    ALTER TABLE ONLY public.conditions_audit
        ADD CONSTRAINT conditions_audit_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: conditions conditions_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conditions_pkey'
      AND conrelid = 'public.conditions'::regclass
  ) THEN
    ALTER TABLE ONLY public.conditions
        ADD CONSTRAINT conditions_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: event_live_chart_configs event_live_chart_configs_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_live_chart_configs_pkey'
      AND conrelid = 'public.event_live_chart_configs'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_live_chart_configs
        ADD CONSTRAINT event_live_chart_configs_pkey PRIMARY KEY (series_slug);
  END IF;
END
$migration$;

-- constraint: event_tags event_tags_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_tags_pkey'
      AND conrelid = 'public.event_tags'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_tags
        ADD CONSTRAINT event_tags_pkey PRIMARY KEY (event_id, tag_id);
  END IF;
END
$migration$;

-- constraint: event_translations event_translations_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_translations_pkey'
      AND conrelid = 'public.event_translations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_translations
        ADD CONSTRAINT event_translations_pkey PRIMARY KEY (event_id, locale);
  END IF;
END
$migration$;

-- constraint: events events_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_pkey'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE ONLY public.events
        ADD CONSTRAINT events_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: events events_slug_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_slug_key'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE ONLY public.events
        ADD CONSTRAINT events_slug_key UNIQUE (slug);
  END IF;
END
$migration$;

-- constraint: market_context_cache market_context_cache_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'market_context_cache_pkey'
      AND conrelid = 'public.market_context_cache'::regclass
  ) THEN
    ALTER TABLE ONLY public.market_context_cache
        ADD CONSTRAINT market_context_cache_pkey PRIMARY KEY (condition_id, locale);
  END IF;
END
$migration$;

-- constraint: markets markets_event_id_slug_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'markets_event_id_slug_key'
      AND conrelid = 'public.markets'::regclass
  ) THEN
    ALTER TABLE ONLY public.markets
        ADD CONSTRAINT markets_event_id_slug_key UNIQUE (event_id, slug);
  END IF;
END
$migration$;

-- constraint: markets markets_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'markets_pkey'
      AND conrelid = 'public.markets'::regclass
  ) THEN
    ALTER TABLE ONLY public.markets
        ADD CONSTRAINT markets_pkey PRIMARY KEY (condition_id);
  END IF;
END
$migration$;

-- constraint: outcomes outcomes_condition_id_outcome_index_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outcomes_condition_id_outcome_index_key'
      AND conrelid = 'public.outcomes'::regclass
  ) THEN
    ALTER TABLE ONLY public.outcomes
        ADD CONSTRAINT outcomes_condition_id_outcome_index_key UNIQUE (condition_id, outcome_index);
  END IF;
END
$migration$;

-- constraint: outcomes outcomes_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outcomes_pkey'
      AND conrelid = 'public.outcomes'::regclass
  ) THEN
    ALTER TABLE ONLY public.outcomes
        ADD CONSTRAINT outcomes_pkey PRIMARY KEY (token_id);
  END IF;
END
$migration$;

-- constraint: tag_translations tag_translations_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tag_translations_pkey'
      AND conrelid = 'public.tag_translations'::regclass
  ) THEN
    ALTER TABLE ONLY public.tag_translations
        ADD CONSTRAINT tag_translations_pkey PRIMARY KEY (tag_id, locale);
  END IF;
END
$migration$;

-- constraint: tags tags_name_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tags_name_key'
      AND conrelid = 'public.tags'::regclass
  ) THEN
    ALTER TABLE ONLY public.tags
        ADD CONSTRAINT tags_name_key UNIQUE (name);
  END IF;
END
$migration$;

-- constraint: tags tags_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tags_pkey'
      AND conrelid = 'public.tags'::regclass
  ) THEN
    ALTER TABLE ONLY public.tags
        ADD CONSTRAINT tags_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- constraint: tags tags_slug_key
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tags_slug_key'
      AND conrelid = 'public.tags'::regclass
  ) THEN
    ALTER TABLE ONLY public.tags
        ADD CONSTRAINT tags_slug_key UNIQUE (slug);
  END IF;
END
$migration$;

-- fk constraint: conditions_audit conditions_audit_condition_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conditions_audit_condition_id_fkey'
      AND conrelid = 'public.conditions_audit'::regclass
  ) THEN
    ALTER TABLE ONLY public.conditions_audit
        ADD CONSTRAINT conditions_audit_condition_id_fkey FOREIGN KEY (condition_id) REFERENCES public.conditions(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: event_tags event_tags_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_tags_event_id_fkey'
      AND conrelid = 'public.event_tags'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_tags
        ADD CONSTRAINT event_tags_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: event_tags event_tags_tag_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_tags_tag_id_fkey'
      AND conrelid = 'public.event_tags'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_tags
        ADD CONSTRAINT event_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: event_translations event_translations_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_translations_event_id_fkey'
      AND conrelid = 'public.event_translations'::regclass
  ) THEN
    ALTER TABLE ONLY public.event_translations
        ADD CONSTRAINT event_translations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: market_context_cache market_context_cache_condition_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'market_context_cache_condition_id_fkey'
      AND conrelid = 'public.market_context_cache'::regclass
  ) THEN
    ALTER TABLE ONLY public.market_context_cache
        ADD CONSTRAINT market_context_cache_condition_id_fkey FOREIGN KEY (condition_id) REFERENCES public.markets(condition_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: markets markets_condition_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'markets_condition_id_fkey'
      AND conrelid = 'public.markets'::regclass
  ) THEN
    ALTER TABLE ONLY public.markets
        ADD CONSTRAINT markets_condition_id_fkey FOREIGN KEY (condition_id) REFERENCES public.conditions(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: markets markets_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'markets_event_id_fkey'
      AND conrelid = 'public.markets'::regclass
  ) THEN
    ALTER TABLE ONLY public.markets
        ADD CONSTRAINT markets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: outcomes outcomes_condition_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outcomes_condition_id_fkey'
      AND conrelid = 'public.outcomes'::regclass
  ) THEN
    ALTER TABLE ONLY public.outcomes
        ADD CONSTRAINT outcomes_condition_id_fkey FOREIGN KEY (condition_id) REFERENCES public.conditions(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: tag_translations tag_translations_tag_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tag_translations_tag_id_fkey'
      AND conrelid = 'public.tag_translations'::regclass
  ) THEN
    ALTER TABLE ONLY public.tag_translations
        ADD CONSTRAINT tag_translations_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_conditions_audit_condition_id_created_at
CREATE INDEX IF NOT EXISTS idx_conditions_audit_condition_id_created_at ON public.conditions_audit USING btree (condition_id, created_at DESC);

-- index: idx_conditions_question_id
CREATE INDEX IF NOT EXISTS idx_conditions_question_id ON public.conditions USING btree (question_id);

-- index: idx_conditions_updated_at_id
CREATE INDEX IF NOT EXISTS idx_conditions_updated_at_id ON public.conditions USING btree (updated_at DESC, id DESC);

-- index: idx_event_tags_tag_id_event_id
CREATE INDEX IF NOT EXISTS idx_event_tags_tag_id_event_id ON public.event_tags USING btree (tag_id, event_id);

-- index: idx_event_translations_locale
CREATE INDEX IF NOT EXISTS idx_event_translations_locale ON public.event_translations USING btree (locale);

-- index: idx_events_end_date
CREATE INDEX IF NOT EXISTS idx_events_end_date ON public.events USING btree (end_date);

-- index: idx_events_slug_lower_gin_trgm
CREATE INDEX IF NOT EXISTS idx_events_slug_lower_gin_trgm ON public.events USING gin (lower(slug) extensions.gin_trgm_ops);

-- index: idx_events_status_active_markets_count
CREATE INDEX IF NOT EXISTS idx_events_status_active_markets_count ON public.events USING btree (status, active_markets_count);

-- index: idx_events_title_lower_gin_trgm
CREATE INDEX IF NOT EXISTS idx_events_title_lower_gin_trgm ON public.events USING gin (lower(title) extensions.gin_trgm_ops);

-- index: idx_market_context_cache_expires_at
CREATE INDEX IF NOT EXISTS idx_market_context_cache_expires_at ON public.market_context_cache USING btree (expires_at);

-- index: idx_markets_active_resolved_condition_id
CREATE INDEX IF NOT EXISTS idx_markets_active_resolved_condition_id ON public.markets USING btree (is_active, is_resolved, condition_id);

-- index: idx_markets_active_resolved_updated_at
CREATE INDEX IF NOT EXISTS idx_markets_active_resolved_updated_at ON public.markets USING btree (is_active, is_resolved, updated_at);

-- index: idx_markets_condition_id_lower
CREATE INDEX IF NOT EXISTS idx_markets_condition_id_lower ON public.markets USING btree (lower(condition_id));

-- index: idx_markets_event_id_active_resolved
CREATE INDEX IF NOT EXISTS idx_markets_event_id_active_resolved ON public.markets USING btree (event_id, is_active, is_resolved);

-- index: idx_markets_event_id_condition_id
CREATE INDEX IF NOT EXISTS idx_markets_event_id_condition_id ON public.markets USING btree (event_id, condition_id);

-- index: idx_markets_neg_risk_request_id
CREATE INDEX IF NOT EXISTS idx_markets_neg_risk_request_id ON public.markets USING btree (neg_risk_request_id) WHERE (neg_risk_request_id IS NOT NULL);

-- index: idx_tag_translations_locale
CREATE INDEX IF NOT EXISTS idx_tag_translations_locale ON public.tag_translations USING btree (locale);

-- index: markets_polymarket_condition_id_idx
CREATE INDEX IF NOT EXISTS markets_polymarket_condition_id_idx ON public.markets USING btree (polymarket_condition_id) WHERE (polymarket_condition_id IS NOT NULL);

-- index: outcomes_polymarket_token_id_idx
CREATE INDEX IF NOT EXISTS outcomes_polymarket_token_id_idx ON public.outcomes USING btree (polymarket_token_id) WHERE (polymarket_token_id IS NOT NULL);

-- function: log_conditions_update()
CREATE OR REPLACE FUNCTION public.log_conditions_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  old_row  JSONB;
  new_row  JSONB;
  diff_old JSONB;
  diff_new JSONB;
BEGIN
  old_row := to_jsonb(OLD) - 'updated_at';
  new_row := to_jsonb(NEW) - 'updated_at';

  SELECT
    jsonb_object_agg(key, old_value),
    jsonb_object_agg(key, new_value)
  INTO diff_old, diff_new
  FROM (
    SELECT key, value AS old_value, new_row -> key AS new_value
    FROM jsonb_each(old_row)
    WHERE value IS DISTINCT FROM new_row -> key
      AND NOT (
        value = 'null'::jsonb
        AND new_row -> key IS DISTINCT FROM 'null'::jsonb
      )
  ) changes;

  IF diff_new IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO conditions_audit (condition_id, old_values, new_values)
  VALUES (OLD.id, diff_old, diff_new);

  RETURN NEW;
END;
$$;

-- function: update_event_markets_count()
CREATE OR REPLACE FUNCTION public.update_event_markets_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE events
    SET active_markets_count = (SELECT COUNT(*)
                                FROM markets
                                WHERE event_id = NEW.event_id
                                  AND is_active = TRUE
                                  AND is_resolved = FALSE),
        total_markets_count  = (SELECT COUNT(*)
                                FROM markets
                                WHERE event_id = NEW.event_id)
    WHERE id = NEW.event_id;
  END IF;

  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.event_id != NEW.event_id) THEN
    UPDATE events
    SET active_markets_count = (SELECT COUNT(*)
                                FROM markets
                                WHERE event_id = OLD.event_id
                                  AND is_active = TRUE
                                  AND is_resolved = FALSE),
        total_markets_count  = (SELECT COUNT(*)
                                FROM markets
                                WHERE event_id = OLD.event_id)
    WHERE id = OLD.event_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- function: update_tag_markets_count()
CREATE OR REPLACE FUNCTION public.update_tag_markets_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  affected_event_id CHAR(26);
BEGIN
  affected_event_id := COALESCE(NEW.event_id, OLD.event_id);

  UPDATE tags
  SET active_markets_count = (SELECT COUNT(DISTINCT m.condition_id)
                              FROM markets m
                                     JOIN event_tags et ON m.event_id = et.event_id
                              WHERE et.tag_id = tags.id
                                AND m.is_active = TRUE
                                AND m.is_resolved = FALSE)
  WHERE id IN (SELECT DISTINCT et.tag_id
               FROM event_tags et
               WHERE et.event_id = affected_event_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- trigger: conditions set_conditions_updated_at
CREATE OR REPLACE TRIGGER set_conditions_updated_at BEFORE UPDATE ON public.conditions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: event_live_chart_configs set_event_live_chart_configs_updated_at
CREATE OR REPLACE TRIGGER set_event_live_chart_configs_updated_at BEFORE UPDATE ON public.event_live_chart_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: event_translations set_event_translations_updated_at
CREATE OR REPLACE TRIGGER set_event_translations_updated_at BEFORE UPDATE ON public.event_translations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: events set_events_updated_at
CREATE OR REPLACE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: market_context_cache set_market_context_cache_updated_at
CREATE OR REPLACE TRIGGER set_market_context_cache_updated_at BEFORE UPDATE ON public.market_context_cache FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: markets set_markets_updated_at
CREATE OR REPLACE TRIGGER set_markets_updated_at BEFORE UPDATE ON public.markets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: outcomes set_outcomes_updated_at
CREATE OR REPLACE TRIGGER set_outcomes_updated_at BEFORE UPDATE ON public.outcomes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: tag_translations set_tag_translations_updated_at
CREATE OR REPLACE TRIGGER set_tag_translations_updated_at BEFORE UPDATE ON public.tag_translations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: tags set_tags_updated_at
CREATE OR REPLACE TRIGGER set_tags_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trigger: conditions trigger_log_conditions_update
CREATE OR REPLACE TRIGGER trigger_log_conditions_update AFTER UPDATE ON public.conditions FOR EACH ROW EXECUTE FUNCTION public.log_conditions_update();

-- trigger: markets trigger_update_event_markets_count
CREATE OR REPLACE TRIGGER trigger_update_event_markets_count AFTER INSERT OR DELETE OR UPDATE ON public.markets FOR EACH ROW EXECUTE FUNCTION public.update_event_markets_count();

-- trigger: markets trigger_update_tag_markets_count
CREATE OR REPLACE TRIGGER trigger_update_tag_markets_count AFTER INSERT OR DELETE OR UPDATE ON public.markets FOR EACH ROW EXECUTE FUNCTION public.update_tag_markets_count();

-- trigger: event_tags trigger_update_tag_markets_count_event_tags
CREATE OR REPLACE TRIGGER trigger_update_tag_markets_count_event_tags AFTER INSERT OR DELETE OR UPDATE ON public.event_tags FOR EACH ROW EXECUTE FUNCTION public.update_tag_markets_count();

-- row security: conditions
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;

-- row security: conditions_audit
ALTER TABLE public.conditions_audit ENABLE ROW LEVEL SECURITY;

-- row security: event_live_chart_configs
ALTER TABLE public.event_live_chart_configs ENABLE ROW LEVEL SECURITY;

-- row security: event_tags
ALTER TABLE public.event_tags ENABLE ROW LEVEL SECURITY;

-- row security: event_translations
ALTER TABLE public.event_translations ENABLE ROW LEVEL SECURITY;

-- row security: events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- row security: market_context_cache
ALTER TABLE public.market_context_cache ENABLE ROW LEVEL SECURITY;

-- row security: markets
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

-- row security: outcomes
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;

-- row security: tag_translations
ALTER TABLE public.tag_translations ENABLE ROW LEVEL SECURITY;

-- row security: tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- policy: conditions service_role_all_conditions
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conditions'
      AND policyname = 'service_role_all_conditions'
  ) THEN
    CREATE POLICY service_role_all_conditions ON public.conditions TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: conditions_audit service_role_all_conditions_audit
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conditions_audit'
      AND policyname = 'service_role_all_conditions_audit'
  ) THEN
    CREATE POLICY service_role_all_conditions_audit ON public.conditions_audit TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: event_live_chart_configs service_role_all_event_live_chart_configs
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_live_chart_configs'
      AND policyname = 'service_role_all_event_live_chart_configs'
  ) THEN
    CREATE POLICY service_role_all_event_live_chart_configs ON public.event_live_chart_configs TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: event_tags service_role_all_event_tags
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_tags'
      AND policyname = 'service_role_all_event_tags'
  ) THEN
    CREATE POLICY service_role_all_event_tags ON public.event_tags TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: event_translations service_role_all_event_translations
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_translations'
      AND policyname = 'service_role_all_event_translations'
  ) THEN
    CREATE POLICY service_role_all_event_translations ON public.event_translations TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: events service_role_all_events
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'service_role_all_events'
  ) THEN
    CREATE POLICY service_role_all_events ON public.events TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: market_context_cache service_role_all_market_context_cache
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'market_context_cache'
      AND policyname = 'service_role_all_market_context_cache'
  ) THEN
    CREATE POLICY service_role_all_market_context_cache ON public.market_context_cache TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: markets service_role_all_markets
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'markets'
      AND policyname = 'service_role_all_markets'
  ) THEN
    CREATE POLICY service_role_all_markets ON public.markets TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: outcomes service_role_all_outcomes
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outcomes'
      AND policyname = 'service_role_all_outcomes'
  ) THEN
    CREATE POLICY service_role_all_outcomes ON public.outcomes TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: tag_translations service_role_all_tag_translations
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tag_translations'
      AND policyname = 'service_role_all_tag_translations'
  ) THEN
    CREATE POLICY service_role_all_tag_translations ON public.tag_translations TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- policy: tags service_role_all_tags
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tags'
      AND policyname = 'service_role_all_tags'
  ) THEN
    CREATE POLICY service_role_all_tags ON public.tags TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;

-- view: v_main_tag_subcategories
CREATE OR REPLACE VIEW public.v_main_tag_subcategories WITH (security_invoker='true') AS
 SELECT main_tag.id AS main_tag_id,
    main_tag.slug AS main_tag_slug,
    main_tag.name AS main_tag_name,
    main_tag.is_hidden AS main_tag_is_hidden,
    sub_tag.id AS sub_tag_id,
    sub_tag.name AS sub_tag_name,
    sub_tag.slug AS sub_tag_slug,
    sub_tag.is_main_category AS sub_tag_is_main_category,
    sub_tag.is_hidden AS sub_tag_is_hidden,
    count(DISTINCT m.condition_id) AS active_markets_count,
    max(m.updated_at) AS last_market_activity_at
   FROM ((((public.tags main_tag
     JOIN public.event_tags et_main ON ((et_main.tag_id = main_tag.id)))
     JOIN public.markets m ON ((m.event_id = et_main.event_id)))
     JOIN public.event_tags et_sub ON ((et_sub.event_id = et_main.event_id)))
     JOIN public.tags sub_tag ON ((sub_tag.id = et_sub.tag_id)))
  WHERE ((main_tag.is_main_category = true) AND (main_tag.is_hidden = false) AND (m.is_active = true) AND (m.is_resolved = false) AND (sub_tag.id <> main_tag.id) AND (sub_tag.is_main_category = false) AND (sub_tag.is_hidden = false))
  GROUP BY main_tag.id, main_tag.slug, main_tag.name, main_tag.is_hidden, sub_tag.id, sub_tag.name, sub_tag.slug, sub_tag.is_main_category, sub_tag.is_hidden;

INSERT INTO public.event_live_chart_configs (
  series_slug,
  topic,
  event_type,
  symbol,
  display_name,
  display_symbol,
  line_color,
  icon_path,
  enabled,
  show_price_decimals,
  active_window_minutes
)
SELECT
  series_slug,
  topic,
  event_type,
  symbol,
  display_name,
  display_symbol,
  line_color,
  icon_path,
  enabled,
  show_price_decimals,
  active_window_minutes
FROM jsonb_to_recordset($seed$
[
  {"topic":"equity_prices","symbol":"AAPL","enabled":true,"icon_path":"/images/live-assets/aapl.svg","event_type":"update","line_color":"#555555","series_slug":"aapl-daily-up-down","display_name":"Apple","display_symbol":"AAPL","show_price_decimals":true,"active_window_minutes":390},
  {"topic":"crypto_prices_chainlink","symbol":"btc/usd","enabled":true,"icon_path":"/images/live-assets/btc.svg","event_type":"update","line_color":"#FF9900","series_slug":"bitcoin-up-or-down-4h","display_name":"Bitcoin","display_symbol":"BTC/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"bnb/usd","enabled":true,"icon_path":"/images/live-assets/bnb.svg","event_type":"update","line_color":"#F0B90B","series_slug":"bnb-up-or-down-15m","display_name":"BNB","display_symbol":"BNB/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"bnb/usd","enabled":true,"icon_path":"/images/live-assets/bnb.svg","event_type":"update","line_color":"#F0B90B","series_slug":"bnb-up-or-down-4h","display_name":"BNB","display_symbol":"BNB/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"bnb/usd","enabled":true,"icon_path":"/images/live-assets/bnb.svg","event_type":"update","line_color":"#F0B90B","series_slug":"bnb-up-or-down-5m","display_name":"BNB","display_symbol":"BNB/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"bnb/usd","enabled":true,"icon_path":"/images/live-assets/bnb.svg","event_type":"update","line_color":"#F0B90B","series_slug":"bnb-up-or-down-daily","display_name":"BNB","display_symbol":"BNB/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"bnb/usd","enabled":true,"icon_path":"/images/live-assets/bnb.svg","event_type":"update","line_color":"#F0B90B","series_slug":"bnb-up-or-down-hourly","display_name":"BNB","display_symbol":"BNB/USD","show_price_decimals":false,"active_window_minutes":60},
  {"topic":"crypto_prices_chainlink","symbol":"btc/usd","enabled":true,"icon_path":"/images/live-assets/btc.svg","event_type":"update","line_color":"#FF9900","series_slug":"btc-up-or-down-15m","display_name":"Bitcoin","display_symbol":"BTC/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"btc/usd","enabled":true,"icon_path":"/images/live-assets/btc.svg","event_type":"update","line_color":"#FF9900","series_slug":"btc-up-or-down-4h","display_name":"Bitcoin","display_symbol":"BTC/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"btc/usd","enabled":true,"icon_path":"/images/live-assets/btc.svg","event_type":"update","line_color":"#FF9900","series_slug":"btc-up-or-down-5m","display_name":"Bitcoin","display_symbol":"BTC/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"btc/usd","enabled":true,"icon_path":"/images/live-assets/btc.svg","event_type":"update","line_color":"#FF9900","series_slug":"btc-up-or-down-daily","display_name":"Bitcoin","display_symbol":"BTC/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"btc/usd","enabled":true,"icon_path":"/images/live-assets/btc.svg","event_type":"update","line_color":"#FF9900","series_slug":"btc-up-or-down-hourly","display_name":"Bitcoin","display_symbol":"BTC/USD","show_price_decimals":false,"active_window_minutes":60},
  {"topic":"crypto_prices_chainlink","symbol":"doge/usd","enabled":true,"icon_path":"/images/live-assets/doge.svg","event_type":"update","line_color":"#C2A633","series_slug":"doge-up-or-down-15m","display_name":"Dogecoin","display_symbol":"DOGE/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"doge/usd","enabled":true,"icon_path":"/images/live-assets/doge.svg","event_type":"update","line_color":"#C2A633","series_slug":"doge-up-or-down-4h","display_name":"Dogecoin","display_symbol":"DOGE/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"doge/usd","enabled":true,"icon_path":"/images/live-assets/doge.svg","event_type":"update","line_color":"#C2A633","series_slug":"doge-up-or-down-5m","display_name":"Dogecoin","display_symbol":"DOGE/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"doge/usd","enabled":true,"icon_path":"/images/live-assets/doge.svg","event_type":"update","line_color":"#C2A633","series_slug":"doge-up-or-down-hourly","display_name":"Dogecoin","display_symbol":"DOGE/USD","show_price_decimals":false,"active_window_minutes":60},
  {"topic":"crypto_prices_chainlink","symbol":"doge/usd","enabled":true,"icon_path":"/images/live-assets/doge.svg","event_type":"update","line_color":"#C2A633","series_slug":"dogecoin-up-or-down-daily","display_name":"Dogecoin","display_symbol":"DOGE/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"eth/usd","enabled":true,"icon_path":"/images/live-assets/eth.svg","event_type":"update","line_color":"#637FEB","series_slug":"eth-up-or-down-15m","display_name":"Ethereum","display_symbol":"ETH/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"eth/usd","enabled":true,"icon_path":"/images/live-assets/eth.svg","event_type":"update","line_color":"#637FEB","series_slug":"eth-up-or-down-4h","display_name":"Ethereum","display_symbol":"ETH/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"eth/usd","enabled":true,"icon_path":"/images/live-assets/eth.svg","event_type":"update","line_color":"#637FEB","series_slug":"eth-up-or-down-5m","display_name":"Ethereum","display_symbol":"ETH/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"eth/usd","enabled":true,"icon_path":"/images/live-assets/eth.svg","event_type":"update","line_color":"#637FEB","series_slug":"eth-up-or-down-daily","display_name":"Ethereum","display_symbol":"ETH/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"eth/usd","enabled":true,"icon_path":"/images/live-assets/eth.svg","event_type":"update","line_color":"#637FEB","series_slug":"eth-up-or-down-hourly","display_name":"Ethereum","display_symbol":"ETH/USD","show_price_decimals":false,"active_window_minutes":60},
  {"topic":"crypto_prices_chainlink","symbol":"eth/usd","enabled":true,"icon_path":"/images/live-assets/eth.svg","event_type":"update","line_color":"#637FEB","series_slug":"ethereum-up-or-down-4h","display_name":"Ethereum","display_symbol":"ETH/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"equity_prices","symbol":"GOOGL","enabled":true,"icon_path":"/images/live-assets/googl.svg","event_type":"update","line_color":"#4285F4","series_slug":"googl-daily-up-down","display_name":"Google","display_symbol":"GOOGL","show_price_decimals":true,"active_window_minutes":390},
  {"topic":"crypto_prices_chainlink","symbol":"hype/usd","enabled":true,"icon_path":"/images/live-assets/hype.svg","event_type":"update","line_color":"#00C2A8","series_slug":"hype-up-or-down-15m","display_name":"HYPE","display_symbol":"HYPE/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"hype/usd","enabled":true,"icon_path":"/images/live-assets/hype.svg","event_type":"update","line_color":"#00C2A8","series_slug":"hype-up-or-down-4h","display_name":"HYPE","display_symbol":"HYPE/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"hype/usd","enabled":true,"icon_path":"/images/live-assets/hype.svg","event_type":"update","line_color":"#00C2A8","series_slug":"hype-up-or-down-5m","display_name":"HYPE","display_symbol":"HYPE/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"hype/usd","enabled":true,"icon_path":"/images/live-assets/hype.svg","event_type":"update","line_color":"#00C2A8","series_slug":"hype-up-or-down-daily","display_name":"HYPE","display_symbol":"HYPE/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"hype/usd","enabled":true,"icon_path":"/images/live-assets/hype.svg","event_type":"update","line_color":"#00C2A8","series_slug":"hype-up-or-down-hourly","display_name":"HYPE","display_symbol":"HYPE/USD","show_price_decimals":false,"active_window_minutes":60},
  {"topic":"equity_prices","symbol":"META","enabled":true,"icon_path":"/images/live-assets/meta.svg","event_type":"update","line_color":"#0866FF","series_slug":"meta-daily-up-down","display_name":"Meta","display_symbol":"META","show_price_decimals":true,"active_window_minutes":390},
  {"topic":"equity_prices","symbol":"MSFT","enabled":true,"icon_path":"/images/live-assets/msft.svg","event_type":"update","line_color":"#0078D4","series_slug":"msft-daily-up-down","display_name":"Microsoft","display_symbol":"MSFT","show_price_decimals":true,"active_window_minutes":390},
  {"topic":"crypto_prices_chainlink","symbol":"sol/usd","enabled":true,"icon_path":"/images/live-assets/sol.svg","event_type":"update","line_color":"#9945FF","series_slug":"sol-up-or-down-15m","display_name":"Solana","display_symbol":"SOL/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"sol/usd","enabled":true,"icon_path":"/images/live-assets/sol.svg","event_type":"update","line_color":"#9945FF","series_slug":"sol-up-or-down-4h","display_name":"Solana","display_symbol":"SOL/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"sol/usd","enabled":true,"icon_path":"/images/live-assets/sol.svg","event_type":"update","line_color":"#9945FF","series_slug":"sol-up-or-down-5m","display_name":"Solana","display_symbol":"SOL/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"sol/usd","enabled":true,"icon_path":"/images/live-assets/sol.svg","event_type":"update","line_color":"#9945FF","series_slug":"solana-up-or-down-4h","display_name":"Solana","display_symbol":"SOL/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"sol/usd","enabled":true,"icon_path":"/images/live-assets/sol.svg","event_type":"update","line_color":"#9945FF","series_slug":"solana-up-or-down-daily","display_name":"Solana","display_symbol":"SOL/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"sol/usd","enabled":true,"icon_path":"/images/live-assets/sol.svg","event_type":"update","line_color":"#9945FF","series_slug":"solana-up-or-down-hourly","display_name":"Solana","display_symbol":"SOL/USD","show_price_decimals":false,"active_window_minutes":60},
  {"topic":"equity_prices","symbol":"TSLA","enabled":true,"icon_path":"/images/live-assets/tsla.svg","event_type":"update","line_color":"#CC0000","series_slug":"tsla-daily-up-down","display_name":"Tesla","display_symbol":"TSLA","show_price_decimals":true,"active_window_minutes":390},
  {"topic":"crypto_prices_chainlink","symbol":"xrp/usd","enabled":true,"icon_path":"/images/live-assets/xrp.svg","event_type":"update","line_color":"#028CFF","series_slug":"xrp-up-or-down-15m","display_name":"XRP","display_symbol":"XRP/USD","show_price_decimals":false,"active_window_minutes":15},
  {"topic":"crypto_prices_chainlink","symbol":"xrp/usd","enabled":true,"icon_path":"/images/live-assets/xrp.svg","event_type":"update","line_color":"#028CFF","series_slug":"xrp-up-or-down-4h","display_name":"XRP","display_symbol":"XRP/USD","show_price_decimals":false,"active_window_minutes":240},
  {"topic":"crypto_prices_chainlink","symbol":"xrp/usd","enabled":true,"icon_path":"/images/live-assets/xrp.svg","event_type":"update","line_color":"#028CFF","series_slug":"xrp-up-or-down-5m","display_name":"XRP","display_symbol":"XRP/USD","show_price_decimals":false,"active_window_minutes":5},
  {"topic":"crypto_prices_chainlink","symbol":"xrp/usd","enabled":true,"icon_path":"/images/live-assets/xrp.svg","event_type":"update","line_color":"#028CFF","series_slug":"xrp-up-or-down-daily","display_name":"XRP","display_symbol":"XRP/USD","show_price_decimals":false,"active_window_minutes":1440},
  {"topic":"crypto_prices_chainlink","symbol":"xrp/usd","enabled":true,"icon_path":"/images/live-assets/xrp.svg","event_type":"update","line_color":"#028CFF","series_slug":"xrp-up-or-down-hourly","display_name":"XRP","display_symbol":"XRP/USD","show_price_decimals":false,"active_window_minutes":60}
]
$seed$::jsonb) AS seed (
    series_slug text,
    topic text,
    event_type text,
    symbol text,
    display_name text,
    display_symbol text,
    line_color text,
    icon_path text,
    enabled boolean,
    show_price_decimals boolean,
    active_window_minutes integer
)
ON CONFLICT DO NOTHING;

INSERT INTO public.settings ("group", key, value)
VALUES ('i18n', 'rules_translations_enabled', 'false')
ON CONFLICT ("group", key) DO NOTHING;
