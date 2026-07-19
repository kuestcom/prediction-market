import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from '@/lib/db/schema/auth/tables'

function ulid() {
  return char({ length: 26 }).primaryKey().default(sql`generate_ulid()`)
}
function createdAt() {
  return timestamp({ withTimezone: true }).notNull().defaultNow()
}
function updatedAt() {
  return timestamp({ withTimezone: true }).notNull().defaultNow()
}

export const identity_programs = pgTable(
  'identity_programs',
  {
    id: ulid(),
    key: text().notNull(),
    name: text().notNull(),
    description: text().notNull().default(''),
    status: text().notNull().default('draft'),
    active_version_id: char({ length: 26 }),
    created_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    keyUniqueIdx: uniqueIndex('idx_identity_programs_key').on(table.key),
    statusIdx: index('idx_identity_programs_status').on(table.status),
  }),
)

export const identity_program_versions = pgTable(
  'identity_program_versions',
  {
    id: ulid(),
    program_id: char({ length: 26 })
      .notNull()
      .references(() => identity_programs.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    status: text().notNull().default('draft'),
    mode: text().notNull().default('self_hosted'),
    decision_policy: text().notNull().default('manual_review'),
    required_evidence: text().notNull().default('self_declared'),
    assignment_rules: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    access_policy: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    retention_policy: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    form_schema_version: integer().notNull().default(1),
    published_at: timestamp({ withTimezone: true }),
    archived_at: timestamp({ withTimezone: true }),
    created_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    programVersionUniqueIdx: uniqueIndex('idx_identity_program_versions_program_version')
      .on(table.program_id, table.version),
    statusIdx: index('idx_identity_program_versions_status').on(table.status),
  }),
)

export const identity_program_assignments = pgTable(
  'identity_program_assignments',
  {
    id: ulid(),
    program_version_id: char({ length: 26 })
      .notNull()
      .references(() => identity_program_versions.id, { onDelete: 'cascade' }),
    country_code: char({ length: 2 }),
    priority: integer().notNull().default(0),
    is_fallback: boolean().notNull().default(false),
    rules: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    versionPriorityIdx: index('idx_identity_program_assignments_version_priority')
      .on(table.program_version_id, table.priority),
    countryIdx: index('idx_identity_program_assignments_country').on(table.country_code),
  }),
)

export const identity_fields = pgTable(
  'identity_fields',
  {
    id: ulid(),
    program_version_id: char({ length: 26 })
      .notNull()
      .references(() => identity_program_versions.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    type: text().notNull(),
    storage_mode: text().notNull().default('local_encrypted'),
    sensitivity: text().notNull().default('personal'),
    section: text().notNull().default('default'),
    display_order: integer().notNull().default(0),
    required: boolean().notNull().default(false),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    conditions: jsonb().$type<Record<string, unknown>[]>().notNull().default([]),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    versionKeyUniqueIdx: uniqueIndex('idx_identity_fields_version_key').on(table.program_version_id, table.key),
    versionOrderIdx: index('idx_identity_fields_version_order').on(table.program_version_id, table.display_order),
  }),
)

export const identity_field_translations = pgTable(
  'identity_field_translations',
  {
    field_id: char({ length: 26 })
      .notNull()
      .references(() => identity_fields.id, { onDelete: 'cascade' }),
    locale: text().notNull(),
    label: text().notNull(),
    description: text().notNull().default(''),
    help_text: text().notNull().default(''),
    placeholder: text().notNull().default(''),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    pk: primaryKey({ columns: [table.field_id, table.locale] }),
  }),
)

export const identity_field_options = pgTable(
  'identity_field_options',
  {
    id: ulid(),
    field_id: char({ length: 26 })
      .notNull()
      .references(() => identity_fields.id, { onDelete: 'cascade' }),
    value_key: text().notNull(),
    display_order: integer().notNull().default(0),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    fieldValueUniqueIdx: uniqueIndex('idx_identity_field_options_field_value').on(table.field_id, table.value_key),
    fieldOrderIdx: index('idx_identity_field_options_field_order').on(table.field_id, table.display_order),
  }),
)

export const identity_field_option_translations = pgTable(
  'identity_field_option_translations',
  {
    option_id: char({ length: 26 })
      .notNull()
      .references(() => identity_field_options.id, { onDelete: 'cascade' }),
    locale: text().notNull(),
    label: text().notNull(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    pk: primaryKey({ columns: [table.option_id, table.locale] }),
  }),
)

export const identity_submissions = pgTable(
  'identity_submissions',
  {
    id: ulid(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    program_id: char({ length: 26 })
      .notNull()
      .references(() => identity_programs.id, { onDelete: 'restrict' }),
    program_version_id: char({ length: 26 })
      .notNull()
      .references(() => identity_program_versions.id, { onDelete: 'restrict' }),
    country_code: char({ length: 2 }),
    status: text().notNull().default('draft'),
    evidence_level: text().notNull().default('self_declared'),
    source: text().notNull().default('self_hosted'),
    attempt_number: integer().notNull().default(1),
    revision: integer().notNull().default(1),
    decision_reason_code: text(),
    submitted_at: timestamp({ withTimezone: true }),
    decided_at: timestamp({ withTimezone: true }),
    expires_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    userStatusIdx: index('idx_identity_submissions_user_status').on(table.user_id, table.status),
    programStatusIdx: index('idx_identity_submissions_program_status').on(table.program_id, table.status),
    expiresIdx: index('idx_identity_submissions_expires').on(table.expires_at),
  }),
)

export const identity_submission_values = pgTable(
  'identity_submission_values',
  {
    id: ulid(),
    submission_id: char({ length: 26 })
      .notNull()
      .references(() => identity_submissions.id, { onDelete: 'cascade' }),
    field_id: char({ length: 26 })
      .notNull()
      .references(() => identity_fields.id, { onDelete: 'restrict' }),
    value_type: text().notNull(),
    encrypted_value: text().notNull(),
    encryption_key_id: text().notNull(),
    blind_index: text(),
    normalization_version: integer().notNull().default(1),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    submissionFieldUniqueIdx: uniqueIndex('idx_identity_submission_values_submission_field')
      .on(table.submission_id, table.field_id),
    blindIndexIdx: index('idx_identity_submission_values_blind_index').on(table.field_id, table.blind_index),
  }),
)

export const identity_documents = pgTable(
  'identity_documents',
  {
    id: ulid(),
    submission_id: char({ length: 26 })
      .notNull()
      .references(() => identity_submissions.id, { onDelete: 'cascade' }),
    field_id: char({ length: 26 }).references(() => identity_fields.id, { onDelete: 'restrict' }),
    object_key: text().notNull(),
    original_filename_encrypted: text(),
    declared_content_type: text().notNull(),
    content_type: text().notNull(),
    size_bytes: integer().notNull(),
    content_hash: text().notNull(),
    scan_status: text().notNull().default('pending'),
    encryption_key_id: text(),
    retention_expires_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    submissionIdx: index('idx_identity_documents_submission').on(table.submission_id),
    scanIdx: index('idx_identity_documents_scan').on(table.scan_status),
  }),
)

export const identity_provider_configs = pgTable(
  'identity_provider_configs',
  {
    id: ulid(),
    key: text().notNull(),
    display_name: text().notNull(),
    adapter: text().notNull(),
    environment: text().notNull().default('sandbox'),
    enabled: boolean().notNull().default(false),
    capabilities: jsonb().$type<string[]>().notNull().default([]),
    public_config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    encrypted_secret: text(),
    encryption_key_id: text(),
    secret_rotated_at: timestamp({ withTimezone: true }),
    created_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    keyUniqueIdx: uniqueIndex('idx_identity_provider_configs_key').on(table.key),
    enabledIdx: index('idx_identity_provider_configs_enabled').on(table.enabled),
  }),
)

export const identity_provider_cases = pgTable(
  'identity_provider_cases',
  {
    id: ulid(),
    provider_config_id: char({ length: 26 })
      .notNull()
      .references(() => identity_provider_configs.id, { onDelete: 'restrict' }),
    submission_id: char({ length: 26 })
      .notNull()
      .references(() => identity_submissions.id, { onDelete: 'cascade' }),
    external_reference: text().notNull(),
    status: text().notNull().default('created'),
    mapped_decision: text(),
    session_reference_encrypted: text(),
    session_expires_at: timestamp({ withTimezone: true }),
    last_reconciled_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    providerReferenceUniqueIdx: uniqueIndex('idx_identity_provider_cases_provider_reference')
      .on(table.provider_config_id, table.external_reference),
    submissionIdx: index('idx_identity_provider_cases_submission').on(table.submission_id),
  }),
)

export const identity_provider_events = pgTable(
  'identity_provider_events',
  {
    id: ulid(),
    provider_config_id: char({ length: 26 })
      .notNull()
      .references(() => identity_provider_configs.id, { onDelete: 'restrict' }),
    external_event_id: text().notNull(),
    event_type: text().notNull(),
    payload_hash: text().notNull(),
    status: text().notNull().default('received'),
    error_code: text(),
    received_at: createdAt(),
    processed_at: timestamp({ withTimezone: true }),
  },
  table => ({
    providerEventUniqueIdx: uniqueIndex('idx_identity_provider_events_provider_event')
      .on(table.provider_config_id, table.external_event_id),
    statusIdx: index('idx_identity_provider_events_status').on(table.status),
  }),
)

export const identity_reviews = pgTable(
  'identity_reviews',
  {
    id: ulid(),
    submission_id: char({ length: 26 })
      .notNull()
      .references(() => identity_submissions.id, { onDelete: 'cascade' }),
    reviewer_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    decision: text().notNull(),
    reason_code: text().notNull(),
    encrypted_note: text(),
    encryption_key_id: text(),
    created_at: createdAt(),
  },
  table => ({
    submissionCreatedIdx: index('idx_identity_reviews_submission_created').on(table.submission_id, table.created_at),
  }),
)

export const identity_consents = pgTable(
  'identity_consents',
  {
    id: ulid(),
    submission_id: char({ length: 26 })
      .notNull()
      .references(() => identity_submissions.id, { onDelete: 'cascade' }),
    consent_key: text().notNull(),
    document_version: text().notNull(),
    locale: text().notNull(),
    content_hash: text().notNull(),
    accepted: boolean().notNull(),
    accepted_at: timestamp({ withTimezone: true }),
    withdrawn_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
  },
  table => ({
    submissionConsentUniqueIdx: uniqueIndex('idx_identity_consents_submission_key_version')
      .on(table.submission_id, table.consent_key, table.document_version),
  }),
)

export const identity_access_grants = pgTable(
  'identity_access_grants',
  {
    id: ulid(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    capability: text().notNull(),
    submission_id: char({ length: 26 }).references(() => identity_submissions.id, { onDelete: 'cascade' }),
    source: text().notNull(),
    policy_revision: integer().notNull().default(1),
    expires_at: timestamp({ withTimezone: true }),
    revoked_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
  },
  table => ({
    userCapabilityIdx: index('idx_identity_access_grants_user_capability')
      .on(table.user_id, table.capability, table.revoked_at),
  }),
)

export const identity_admin_permissions = pgTable(
  'identity_admin_permissions',
  {
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text().notNull(),
    granted_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    expires_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
  },
  table => ({
    pk: primaryKey({ columns: [table.user_id, table.permission] }),
  }),
)

export const identity_audit_events = pgTable(
  'identity_audit_events',
  {
    id: ulid(),
    actor_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    subject_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    target_type: text().notNull(),
    target_id: text(),
    reason_code: text(),
    result: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    created_at: createdAt(),
  },
  table => ({
    actorCreatedIdx: index('idx_identity_audit_events_actor_created').on(table.actor_user_id, table.created_at),
    subjectCreatedIdx: index('idx_identity_audit_events_subject_created').on(table.subject_user_id, table.created_at),
    actionCreatedIdx: index('idx_identity_audit_events_action_created').on(table.action, table.created_at),
  }),
)

export const identity_erasure_requests = pgTable(
  'identity_erasure_requests',
  {
    id: ulid(),
    user_id: text().references(() => users.id, { onDelete: 'set null' }),
    requested_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    scope: text().notNull().default('identity_only'),
    status: text().notNull().default('pending'),
    reason_code: text(),
    progress: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    requested_at: createdAt(),
    started_at: timestamp({ withTimezone: true }),
    completed_at: timestamp({ withTimezone: true }),
    updated_at: updatedAt(),
  },
  table => ({
    userStatusIdx: index('idx_identity_erasure_requests_user_status').on(table.user_id, table.status),
    statusUpdatedIdx: index('idx_identity_erasure_requests_status_updated').on(table.status, table.updated_at),
  }),
)

export const identity_legal_holds = pgTable(
  'identity_legal_holds',
  {
    id: ulid(),
    user_id: text().references(() => users.id, { onDelete: 'set null' }),
    submission_id: char({ length: 26 }).references(() => identity_submissions.id, { onDelete: 'set null' }),
    reason: text().notNull(),
    authority: text().notNull(),
    created_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
    expires_at: timestamp({ withTimezone: true }),
    released_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
  },
  table => ({
    userActiveIdx: index('idx_identity_legal_holds_user_active').on(table.user_id, table.released_at),
  }),
)

export const identity_data_exports = pgTable(
  'identity_data_exports',
  {
    id: ulid(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text().notNull().default('pending'),
    object_key: text(),
    encrypted_password: text(),
    encryption_key_id: text(),
    expires_at: timestamp({ withTimezone: true }),
    download_count: integer().notNull().default(0),
    created_at: createdAt(),
    completed_at: timestamp({ withTimezone: true }),
  },
  table => ({
    userStatusIdx: index('idx_identity_data_exports_user_status').on(table.user_id, table.status),
  }),
)

export const identity_document_access_tokens = pgTable(
  'identity_document_access_tokens',
  {
    id: ulid(),
    document_id: char({ length: 26 })
      .notNull()
      .references(() => identity_documents.id, { onDelete: 'cascade' }),
    requested_by_user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text().notNull(),
    reason_code: text().notNull(),
    expires_at: timestamp({ withTimezone: true }).notNull(),
    used_at: timestamp({ withTimezone: true }),
    created_at: createdAt(),
  },
  table => ({
    tokenHashUniqueIdx: uniqueIndex('idx_identity_document_access_tokens_hash').on(table.token_hash),
    documentExpiresIdx: index('idx_identity_document_access_tokens_document').on(table.document_id, table.expires_at),
  }),
)

export const identity_operation_rate_limits = pgTable(
  'identity_operation_rate_limits',
  {
    id: ulid(),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    operation: text().notNull(),
    window_started_at: timestamp({ withTimezone: true }).notNull(),
    attempt_count: integer().notNull().default(0),
    updated_at: updatedAt(),
  },
  table => ({
    userOperationUniqueIdx: uniqueIndex('idx_identity_operation_rate_limits_user_operation').on(table.user_id, table.operation),
  }),
)

export const identity_outbox_events = pgTable(
  'identity_outbox_events',
  {
    id: ulid(),
    event_type: text().notNull(),
    aggregate_type: text().notNull(),
    aggregate_id: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    idempotency_key: text().notNull(),
    status: text().notNull().default('pending'),
    attempt_count: integer().notNull().default(0),
    available_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processed_at: timestamp({ withTimezone: true }),
    last_error_code: text(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  table => ({
    idempotencyUniqueIdx: uniqueIndex('idx_identity_outbox_events_idempotency').on(table.idempotency_key),
    statusAvailableIdx: index('idx_identity_outbox_events_status_available').on(table.status, table.available_at),
  }),
)
