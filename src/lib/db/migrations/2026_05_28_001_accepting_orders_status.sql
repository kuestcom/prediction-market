-- Status flags are derived from markets.metadata at runtime.
-- Keeping this migration as a no-op avoids blocking Vercel/Supabase deploys
-- on large markets tables that cannot acquire ALTER TABLE locks quickly.
SELECT 1;
