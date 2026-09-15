-- table: bookmarks
CREATE TABLE IF NOT EXISTS public.bookmarks (
    user_id character(26) NOT NULL,
    event_id character(26) NOT NULL
);

-- constraint: bookmarks bookmarks_pkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookmarks_pkey'
      AND conrelid = 'public.bookmarks'::regclass
  ) THEN
    ALTER TABLE ONLY public.bookmarks
        ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (user_id, event_id);
  END IF;
END
$migration$;

-- fk constraint: bookmarks bookmarks_event_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookmarks_event_id_fkey'
      AND conrelid = 'public.bookmarks'::regclass
  ) THEN
    ALTER TABLE ONLY public.bookmarks
        ADD CONSTRAINT bookmarks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- fk constraint: bookmarks bookmarks_user_id_fkey
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookmarks_user_id_fkey'
      AND conrelid = 'public.bookmarks'::regclass
  ) THEN
    ALTER TABLE ONLY public.bookmarks
        ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$migration$;

-- index: idx_bookmarks_event_id
CREATE INDEX IF NOT EXISTS idx_bookmarks_event_id ON public.bookmarks USING btree (event_id);

-- row security: bookmarks
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- policy: bookmarks service_role_all_bookmarks
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookmarks'
      AND policyname = 'service_role_all_bookmarks'
  ) THEN
    CREATE POLICY service_role_all_bookmarks ON public.bookmarks TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$migration$;
