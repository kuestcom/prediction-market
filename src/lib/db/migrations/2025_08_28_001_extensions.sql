CREATE SCHEMA IF NOT EXISTS extensions;

DO
$$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
      CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
    END IF;
  END
$$;

DO
$$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    END IF;
  END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
