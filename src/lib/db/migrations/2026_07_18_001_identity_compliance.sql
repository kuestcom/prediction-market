-- Generic, country-neutral identity/KYC foundation. The feature remains disabled
-- until an operator explicitly publishes a program and enables it in /admin.

INSERT INTO settings ("group", key, value)
VALUES
  ('identity', 'enabled', 'false'),
  ('identity', 'observe_only', 'false'),
  ('identity', 'policy_revision', '1')
ON CONFLICT ("group", key) DO NOTHING;

CREATE TABLE identity_programs (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  active_version_id CHAR(26),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_programs_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT identity_programs_key_check CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$')
);

CREATE UNIQUE INDEX idx_identity_programs_key ON identity_programs (key);
CREATE INDEX idx_identity_programs_status ON identity_programs (status);

CREATE TABLE identity_program_versions (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  program_id CHAR(26) NOT NULL REFERENCES identity_programs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  mode TEXT NOT NULL DEFAULT 'self_hosted',
  decision_policy TEXT NOT NULL DEFAULT 'manual_review',
  required_evidence TEXT NOT NULL DEFAULT 'self_declared',
  assignment_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  access_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_schema_version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_program_versions_version_check CHECK (version > 0),
  CONSTRAINT identity_program_versions_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT identity_program_versions_mode_check CHECK (mode IN ('self_hosted', 'provider', 'hybrid')),
  CONSTRAINT identity_program_versions_decision_policy_check CHECK (
    decision_policy IN ('auto_on_valid_submission', 'manual_review', 'provider_decision', 'provider_plus_manual', 'rules')
  ),
  CONSTRAINT identity_program_versions_evidence_check CHECK (
    required_evidence IN ('self_declared', 'document_submitted', 'provider_verified', 'manual_verified')
  ),
  CONSTRAINT identity_program_versions_schema_check CHECK (form_schema_version > 0),
  CONSTRAINT identity_program_versions_rules_object_check CHECK (jsonb_typeof(assignment_rules) = 'object'),
  CONSTRAINT identity_program_versions_access_object_check CHECK (jsonb_typeof(access_policy) = 'object'),
  CONSTRAINT identity_program_versions_retention_object_check CHECK (jsonb_typeof(retention_policy) = 'object')
);

CREATE UNIQUE INDEX idx_identity_program_versions_program_version
  ON identity_program_versions (program_id, version);
CREATE INDEX idx_identity_program_versions_status ON identity_program_versions (status);

ALTER TABLE identity_programs
  ADD CONSTRAINT identity_programs_active_version_fk
  FOREIGN KEY (active_version_id)
  REFERENCES identity_program_versions(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE TABLE identity_program_assignments (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  program_version_id CHAR(26) NOT NULL REFERENCES identity_program_versions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  country_code CHAR(2),
  priority INTEGER NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_program_assignments_country_check CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT identity_program_assignments_rules_check CHECK (jsonb_typeof(rules) = 'object')
);

CREATE INDEX idx_identity_program_assignments_version_priority
  ON identity_program_assignments (program_version_id, priority);
CREATE INDEX idx_identity_program_assignments_country ON identity_program_assignments (country_code);
CREATE UNIQUE INDEX idx_identity_program_assignments_version_fallback
  ON identity_program_assignments (program_version_id)
  WHERE is_fallback = TRUE;

CREATE TABLE identity_fields (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  program_version_id CHAR(26) NOT NULL REFERENCES identity_program_versions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  key TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_mode TEXT NOT NULL DEFAULT 'local_encrypted',
  sensitivity TEXT NOT NULL DEFAULT 'personal',
  section TEXT NOT NULL DEFAULT 'default',
  display_order INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_fields_key_check CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT identity_fields_type_check CHECK (type IN (
    'short_text', 'long_text', 'integer', 'decimal', 'date', 'boolean', 'single_select', 'multi_select',
    'radio', 'country', 'subdivision', 'phone', 'email', 'national_identifier', 'address', 'file', 'document',
    'heading', 'paragraph', 'notice', 'separator'
  )),
  CONSTRAINT identity_fields_storage_check CHECK (storage_mode IN (
    'local_encrypted', 'provider_only', 'transient_forward_only', 'derived_result_only'
  )),
  CONSTRAINT identity_fields_sensitivity_check CHECK (sensitivity IN ('public', 'personal', 'sensitive', 'restricted')),
  CONSTRAINT identity_fields_order_check CHECK (display_order >= 0),
  CONSTRAINT identity_fields_config_check CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT identity_fields_conditions_check CHECK (jsonb_typeof(conditions) = 'array')
);

CREATE UNIQUE INDEX idx_identity_fields_version_key ON identity_fields (program_version_id, key);
CREATE INDEX idx_identity_fields_version_order ON identity_fields (program_version_id, display_order);

CREATE TABLE identity_field_translations (
  field_id CHAR(26) NOT NULL REFERENCES identity_fields(id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  help_text TEXT NOT NULL DEFAULT '',
  placeholder TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (field_id, locale),
  CONSTRAINT identity_field_translations_locale_check CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT identity_field_translations_label_check CHECK (length(trim(label)) > 0)
);

CREATE TABLE identity_field_options (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  field_id CHAR(26) NOT NULL REFERENCES identity_fields(id) ON DELETE CASCADE ON UPDATE CASCADE,
  value_key TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_field_options_value_key_check CHECK (value_key ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$'),
  CONSTRAINT identity_field_options_order_check CHECK (display_order >= 0),
  CONSTRAINT identity_field_options_config_check CHECK (jsonb_typeof(config) = 'object')
);

CREATE UNIQUE INDEX idx_identity_field_options_field_value ON identity_field_options (field_id, value_key);
CREATE INDEX idx_identity_field_options_field_order ON identity_field_options (field_id, display_order);

CREATE TABLE identity_field_option_translations (
  option_id CHAR(26) NOT NULL REFERENCES identity_field_options(id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (option_id, locale),
  CONSTRAINT identity_field_option_translations_locale_check CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT identity_field_option_translations_label_check CHECK (length(trim(label)) > 0)
);

CREATE TABLE identity_submissions (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  program_id CHAR(26) NOT NULL REFERENCES identity_programs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  program_version_id CHAR(26) NOT NULL REFERENCES identity_program_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  country_code CHAR(2),
  status TEXT NOT NULL DEFAULT 'draft',
  evidence_level TEXT NOT NULL DEFAULT 'self_declared',
  source TEXT NOT NULL DEFAULT 'self_hosted',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  decision_reason_code TEXT,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_submissions_country_check CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT identity_submissions_status_check CHECK (status IN (
    'not_required', 'not_started', 'draft', 'pending', 'under_review', 'approved', 'rejected',
    'needs_resubmission', 'expired', 'suspended'
  )),
  CONSTRAINT identity_submissions_evidence_check CHECK (
    evidence_level IN ('self_declared', 'document_submitted', 'provider_verified', 'manual_verified')
  ),
  CONSTRAINT identity_submissions_source_check CHECK (source IN ('self_hosted', 'provider', 'hybrid')),
  CONSTRAINT identity_submissions_attempt_check CHECK (attempt_number > 0),
  CONSTRAINT identity_submissions_revision_check CHECK (revision > 0)
);

CREATE INDEX idx_identity_submissions_user_status ON identity_submissions (user_id, status);
CREATE INDEX idx_identity_submissions_program_status ON identity_submissions (program_id, status);
CREATE INDEX idx_identity_submissions_expires ON identity_submissions (expires_at);
CREATE UNIQUE INDEX idx_identity_submissions_one_active_attempt
  ON identity_submissions (user_id, program_id)
  WHERE status IN ('draft', 'pending', 'under_review', 'needs_resubmission');

CREATE TABLE identity_submission_values (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  submission_id CHAR(26) NOT NULL REFERENCES identity_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  field_id CHAR(26) NOT NULL REFERENCES identity_fields(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  value_type TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  blind_index TEXT,
  normalization_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_submission_values_normalization_check CHECK (normalization_version > 0)
);

CREATE UNIQUE INDEX idx_identity_submission_values_submission_field
  ON identity_submission_values (submission_id, field_id);
CREATE INDEX idx_identity_submission_values_blind_index
  ON identity_submission_values (field_id, blind_index)
  WHERE blind_index IS NOT NULL;

CREATE TABLE identity_documents (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  submission_id CHAR(26) NOT NULL REFERENCES identity_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  field_id CHAR(26) REFERENCES identity_fields(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  object_key TEXT NOT NULL,
  original_filename_encrypted TEXT,
  declared_content_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  encryption_key_id TEXT,
  retention_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_documents_size_check CHECK (size_bytes > 0),
  CONSTRAINT identity_documents_scan_check CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed', 'deleted'))
);

CREATE INDEX idx_identity_documents_submission ON identity_documents (submission_id);
CREATE INDEX idx_identity_documents_scan ON identity_documents (scan_status);

CREATE TABLE identity_provider_configs (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  adapter TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_secret TEXT,
  encryption_key_id TEXT,
  secret_rotated_at TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_provider_configs_key_check CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT identity_provider_configs_adapter_check CHECK (adapter IN ('generic_webhook')),
  CONSTRAINT identity_provider_configs_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT identity_provider_configs_capabilities_check CHECK (jsonb_typeof(capabilities) = 'array'),
  CONSTRAINT identity_provider_configs_public_config_check CHECK (jsonb_typeof(public_config) = 'object')
);

CREATE UNIQUE INDEX idx_identity_provider_configs_key ON identity_provider_configs (key);
CREATE INDEX idx_identity_provider_configs_enabled ON identity_provider_configs (enabled);

CREATE TABLE identity_provider_cases (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  provider_config_id CHAR(26) NOT NULL REFERENCES identity_provider_configs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  submission_id CHAR(26) NOT NULL REFERENCES identity_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  external_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  mapped_decision TEXT,
  session_reference_encrypted TEXT,
  session_expires_at TIMESTAMPTZ,
  last_reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_provider_cases_status_check CHECK (status IN (
    'created', 'pending', 'under_review', 'approved', 'rejected', 'needs_resubmission', 'expired',
    'suspended', 'provider_unavailable', 'deleted'
  )),
  CONSTRAINT identity_provider_cases_decision_check CHECK (
    mapped_decision IS NULL OR mapped_decision IN ('pending', 'under_review', 'approved', 'rejected', 'needs_resubmission', 'expired', 'suspended')
  )
);

CREATE UNIQUE INDEX idx_identity_provider_cases_provider_reference
  ON identity_provider_cases (provider_config_id, external_reference);
CREATE INDEX idx_identity_provider_cases_submission ON identity_provider_cases (submission_id);

CREATE TABLE identity_provider_events (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  provider_config_id CHAR(26) NOT NULL REFERENCES identity_provider_configs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  error_code TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT identity_provider_events_status_check CHECK (status IN ('received', 'processed', 'ignored', 'failed_retryable', 'failed_permanent'))
);

CREATE UNIQUE INDEX idx_identity_provider_events_provider_event
  ON identity_provider_events (provider_config_id, external_event_id);
CREATE INDEX idx_identity_provider_events_status ON identity_provider_events (status);

CREATE TABLE identity_reviews (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  submission_id CHAR(26) NOT NULL REFERENCES identity_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  encrypted_note TEXT,
  encryption_key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_reviews_decision_check CHECK (decision IN ('approved', 'rejected', 'needs_resubmission', 'suspended'))
);

CREATE INDEX idx_identity_reviews_submission_created ON identity_reviews (submission_id, created_at);

CREATE TABLE identity_consents (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  submission_id CHAR(26) NOT NULL REFERENCES identity_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  consent_key TEXT NOT NULL,
  document_version TEXT NOT NULL,
  locale TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_identity_consents_submission_key_version
  ON identity_consents (submission_id, consent_key, document_version);

CREATE TABLE identity_access_grants (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  capability TEXT NOT NULL,
  submission_id CHAR(26) REFERENCES identity_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  source TEXT NOT NULL,
  policy_revision INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_access_grants_capability_check CHECK (capability IN (
    'browse_public', 'view_account', 'edit_profile', 'create_deposit_wallet', 'deposit', 'approve_tokens',
    'trade', 'cancel_orders', 'claim_or_redeem', 'withdraw', 'affiliate_claim', 'sdk_api_keys', 'create_market', 'admin'
  )),
  CONSTRAINT identity_access_grants_revision_check CHECK (policy_revision > 0)
);

CREATE INDEX idx_identity_access_grants_user_capability
  ON identity_access_grants (user_id, capability, revoked_at);
CREATE UNIQUE INDEX idx_identity_access_grants_one_active
  ON identity_access_grants (user_id, capability)
  WHERE revoked_at IS NULL;

CREATE TABLE identity_admin_permissions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  permission TEXT NOT NULL,
  granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission),
  CONSTRAINT identity_admin_permissions_permission_check CHECK (permission IN (
    'identity_configure', 'identity_review', 'identity_view_pii', 'identity_export', 'identity_delete',
    'identity_audit', 'identity_manage_legal_hold', 'identity_manage_permissions'
  ))
);

CREATE TABLE identity_audit_events (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  subject_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason_code TEXT,
  result TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_audit_events_result_check CHECK (result IN ('success', 'denied', 'failed')),
  CONSTRAINT identity_audit_events_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_identity_audit_events_actor_created ON identity_audit_events (actor_user_id, created_at);
CREATE INDEX idx_identity_audit_events_subject_created ON identity_audit_events (subject_user_id, created_at);
CREATE INDEX idx_identity_audit_events_action_created ON identity_audit_events (action, created_at);

CREATE TABLE identity_erasure_requests (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  requested_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  scope TEXT NOT NULL DEFAULT 'identity_only',
  status TEXT NOT NULL DEFAULT 'pending',
  reason_code TEXT,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_erasure_requests_scope_check CHECK (scope IN ('identity_only', 'full_account', 'program')),
  CONSTRAINT identity_erasure_requests_status_check CHECK (status IN (
    'pending', 'processing', 'completed', 'failed_retryable', 'needs_attention',
    'blocked_by_retention', 'blocked_legal_hold', 'partially_completed'
  )),
  CONSTRAINT identity_erasure_requests_progress_check CHECK (jsonb_typeof(progress) = 'object')
);

CREATE INDEX idx_identity_erasure_requests_user_status ON identity_erasure_requests (user_id, status);
CREATE INDEX idx_identity_erasure_requests_status_updated ON identity_erasure_requests (status, updated_at);

CREATE TABLE identity_legal_holds (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  submission_id CHAR(26) REFERENCES identity_submissions(id) ON DELETE SET NULL ON UPDATE CASCADE,
  reason TEXT NOT NULL,
  authority TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_legal_holds_target_check CHECK (user_id IS NOT NULL OR submission_id IS NOT NULL)
);

CREATE INDEX idx_identity_legal_holds_user_active ON identity_legal_holds (user_id, released_at);

CREATE TABLE identity_data_exports (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  object_key TEXT,
  encrypted_password TEXT,
  encryption_key_id TEXT,
  expires_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT identity_data_exports_status_check CHECK (status IN ('pending', 'processing', 'ready', 'expired', 'failed', 'deleted')),
  CONSTRAINT identity_data_exports_download_count_check CHECK (download_count >= 0)
);

CREATE INDEX idx_identity_data_exports_user_status ON identity_data_exports (user_id, status);

CREATE TABLE identity_document_access_tokens (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  document_id CHAR(26) NOT NULL REFERENCES identity_documents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_identity_document_access_tokens_hash ON identity_document_access_tokens (token_hash);
CREATE INDEX idx_identity_document_access_tokens_document ON identity_document_access_tokens (document_id, expires_at);

CREATE TABLE identity_operation_rate_limits (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  operation TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_operation_rate_limits_operation_check CHECK (operation ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT identity_operation_rate_limits_attempt_check CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX idx_identity_operation_rate_limits_user_operation
  ON identity_operation_rate_limits (user_id, operation);

CREATE TABLE identity_outbox_events (
  id CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_outbox_events_payload_check CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT identity_outbox_events_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed_retryable', 'failed_permanent')),
  CONSTRAINT identity_outbox_events_attempt_check CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX idx_identity_outbox_events_idempotency ON identity_outbox_events (idempotency_key);
CREATE INDEX idx_identity_outbox_events_status_available ON identity_outbox_events (status, available_at);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'identity_programs',
    'identity_program_versions',
    'identity_program_assignments',
    'identity_fields',
    'identity_field_translations',
    'identity_field_options',
    'identity_field_option_translations',
    'identity_submissions',
    'identity_submission_values',
    'identity_documents',
    'identity_provider_configs',
    'identity_provider_cases',
    'identity_provider_events',
    'identity_reviews',
    'identity_consents',
    'identity_access_grants',
    'identity_admin_permissions',
    'identity_audit_events',
    'identity_erasure_requests',
    'identity_legal_holds',
    'identity_data_exports',
    'identity_document_access_tokens',
    'identity_operation_rate_limits',
    'identity_outbox_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'service_role_all_' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE)',
      'service_role_all_' || table_name,
      table_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'identity_programs',
    'identity_program_versions',
    'identity_program_assignments',
    'identity_fields',
    'identity_field_translations',
    'identity_field_options',
    'identity_field_option_translations',
    'identity_submissions',
    'identity_submission_values',
    'identity_documents',
    'identity_provider_configs',
    'identity_provider_cases',
    'identity_erasure_requests',
    'identity_operation_rate_limits',
    'identity_outbox_events'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I',
      'set_' || table_name || '_updated_at',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS prevent_published_identity_version_mutation ON identity_program_versions;
CREATE OR REPLACE FUNCTION prevent_published_identity_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('published', 'archived') AND (
    NEW.program_id IS DISTINCT FROM OLD.program_id OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.mode IS DISTINCT FROM OLD.mode OR
    NEW.decision_policy IS DISTINCT FROM OLD.decision_policy OR
    NEW.required_evidence IS DISTINCT FROM OLD.required_evidence OR
    NEW.assignment_rules IS DISTINCT FROM OLD.assignment_rules OR
    NEW.access_policy IS DISTINCT FROM OLD.access_policy OR
    NEW.retention_policy IS DISTINCT FROM OLD.retention_policy OR
    NEW.form_schema_version IS DISTINCT FROM OLD.form_schema_version OR
    NOT (
      NEW.status = OLD.status OR
      (OLD.status = 'published' AND NEW.status = 'archived')
    )
  ) THEN
    RAISE EXCEPTION 'Published identity program versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_published_identity_version_mutation
  BEFORE UPDATE ON identity_program_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_identity_version_mutation();

CREATE OR REPLACE FUNCTION prevent_published_identity_child_mutation()
RETURNS TRIGGER AS $$
DECLARE
  version_status TEXT;
  resolved_version_id CHAR(26);
BEGIN
  IF TG_TABLE_NAME = 'identity_fields' OR TG_TABLE_NAME = 'identity_program_assignments' THEN
    IF TG_OP = 'DELETE' THEN
      resolved_version_id := OLD.program_version_id;
    ELSE
      resolved_version_id := NEW.program_version_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'identity_field_translations' THEN
    SELECT f.program_version_id INTO resolved_version_id
      FROM identity_fields f
      WHERE f.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.field_id ELSE NEW.field_id END;
  ELSIF TG_TABLE_NAME = 'identity_field_options' THEN
    SELECT f.program_version_id INTO resolved_version_id
      FROM identity_fields f
      WHERE f.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.field_id ELSE NEW.field_id END;
  ELSE
    SELECT f.program_version_id INTO resolved_version_id
      FROM identity_field_options o
      JOIN identity_fields f ON f.id = o.field_id
      WHERE o.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.option_id ELSE NEW.option_id END;
  END IF;

  SELECT status INTO version_status FROM identity_program_versions WHERE id = resolved_version_id;
  IF version_status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'Published identity form definitions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_published_identity_fields_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON identity_fields
  FOR EACH ROW EXECUTE FUNCTION prevent_published_identity_child_mutation();
CREATE TRIGGER prevent_published_identity_assignments_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON identity_program_assignments
  FOR EACH ROW EXECUTE FUNCTION prevent_published_identity_child_mutation();
CREATE TRIGGER prevent_published_identity_field_translations_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON identity_field_translations
  FOR EACH ROW EXECUTE FUNCTION prevent_published_identity_child_mutation();
CREATE TRIGGER prevent_published_identity_field_options_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON identity_field_options
  FOR EACH ROW EXECUTE FUNCTION prevent_published_identity_child_mutation();
CREATE TRIGGER prevent_published_identity_option_translations_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON identity_field_option_translations
  FOR EACH ROW EXECUTE FUNCTION prevent_published_identity_child_mutation();
