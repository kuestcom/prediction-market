-- table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id character(26) DEFAULT public.generate_ulid() NOT NULL,
    user_id character(26) NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    extra_info text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    link_type text DEFAULT 'none'::text NOT NULL,
    link_target text,
    link_url text,
    link_label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_category_check CHECK ((category = ANY (ARRAY['trade'::text, 'system'::text, 'general'::text]))),
    CONSTRAINT notifications_check CHECK (((link_type <> 'external'::text) OR (link_url IS NOT NULL))),
    CONSTRAINT notifications_check1 CHECK (((link_type <> ALL (ARRAY['market'::text, 'event'::text, 'order'::text, 'settings'::text, 'profile'::text])) OR (link_target IS NOT NULL))),
    CONSTRAINT notifications_link_type_check CHECK ((link_type = ANY (ARRAY['none'::text, 'market'::text, 'event'::text, 'order'::text, 'settings'::text, 'profile'::text, 'external'::text, 'custom'::text]))),
    CONSTRAINT notifications_link_url_check CHECK (((link_url IS NULL) OR (char_length(link_url) <= 2048)))
);

-- constraint: notifications notifications_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_pkey'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE ONLY public.notifications
        ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END
$migration$;

-- fk constraint: notifications notifications_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_user_id_fkey'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE ONLY public.notifications
        ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_notifications_category
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications USING btree (category);

-- index: idx_notifications_user_created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications USING btree (user_id, created_at DESC);

-- row security: notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- policy: notifications service_role_all_notifications
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'service_role_all_notifications'
  ) THEN
    CREATE POLICY service_role_all_notifications ON public.notifications TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;
