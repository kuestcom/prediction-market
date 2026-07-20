CREATE TABLE IF NOT EXISTS sumsub_applicants (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL UNIQUE,
  applicant_id TEXT UNIQUE,
  level_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'pending', 'on_hold', 'approved', 'rejected', 'error')),
  review_status TEXT,
  review_answer TEXT,
  last_event_created_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sumsub_applicants_level_status ON sumsub_applicants(level_name, status);

CREATE TABLE IF NOT EXISTS sumsub_webhook_events (
  fingerprint TEXT PRIMARY KEY,
  applicant_id TEXT,
  event_type TEXT NOT NULL,
  event_created_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sumsub_access_token_rate_limits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, scope)
);

ALTER TABLE sumsub_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sumsub_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sumsub_access_token_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_sumsub_applicants" ON sumsub_applicants FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_sumsub_webhook_events" ON sumsub_webhook_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_all_sumsub_rate_limits" ON sumsub_access_token_rate_limits FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

INSERT INTO settings ("group", key, value)
VALUES ('integrations', 'sumsub_enabled', 'false'),
       ('integrations', 'sumsub_app_token', ''),
       ('integrations', 'sumsub_secret_key', ''),
       ('integrations', 'sumsub_webhook_secret', ''),
       ('integrations', 'sumsub_level_name', ''),
       ('integrations', 'sumsub_enforcement', 'disabled')
ON CONFLICT ("group", key) DO NOTHING;
