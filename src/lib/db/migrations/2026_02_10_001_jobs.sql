-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE jobs
(
  id          CHAR(26)     PRIMARY KEY DEFAULT generate_ulid(),
  job_type    TEXT        NOT NULL,
  dedupe_key  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT        NOT NULL DEFAULT 'pending',
  attempts    SMALLINT    NOT NULL DEFAULT 0,
  max_attempts SMALLINT   NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reserved_at TIMESTAMPTZ,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CHECK (attempts >= 0),
  CHECK (max_attempts > 0),
  UNIQUE (job_type, dedupe_key)
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

CREATE INDEX idx_jobs_status_available_at ON jobs (status, available_at);
CREATE INDEX idx_jobs_job_type_status_available_at ON jobs (job_type, status, available_at);
CREATE INDEX idx_jobs_status_updated_at ON jobs (status, updated_at);
CREATE INDEX idx_jobs_status_reserved_at ON jobs (status, reserved_at);

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE jobs
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_jobs" ON "jobs" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. TRIGGERS
-- ===========================================

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE
  ON jobs
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
