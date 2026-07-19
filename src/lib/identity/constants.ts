export const IDENTITY_SETTINGS_GROUP = 'identity'
export const IDENTITY_ENABLED_SETTINGS_KEY = 'enabled'
export const IDENTITY_OBSERVE_ONLY_SETTINGS_KEY = 'observe_only'
export const IDENTITY_POLICY_REVISION_SETTINGS_KEY = 'policy_revision'

export const IDENTITY_PROGRAM_MODES = ['self_hosted', 'provider', 'hybrid'] as const
export const IDENTITY_DECISION_POLICIES = [
  'auto_on_valid_submission',
  'manual_review',
  'provider_decision',
  'provider_plus_manual',
  'rules',
] as const
export const IDENTITY_EVIDENCE_LEVELS = [
  'self_declared',
  'document_submitted',
  'provider_verified',
  'manual_verified',
] as const
export const IDENTITY_SUBMISSION_STATUSES = [
  'not_required',
  'not_started',
  'draft',
  'pending',
  'under_review',
  'approved',
  'rejected',
  'needs_resubmission',
  'expired',
  'suspended',
] as const
export const IDENTITY_FIELD_TYPES = [
  'short_text',
  'long_text',
  'integer',
  'decimal',
  'date',
  'boolean',
  'single_select',
  'multi_select',
  'radio',
  'country',
  'subdivision',
  'phone',
  'email',
  'national_identifier',
  'address',
  'file',
  'document',
  'heading',
  'paragraph',
  'notice',
  'separator',
] as const
export const IDENTITY_STORAGE_MODES = [
  'local_encrypted',
  'provider_only',
  'transient_forward_only',
  'derived_result_only',
] as const
export const IDENTITY_SENSITIVITY_LEVELS = ['public', 'personal', 'sensitive', 'restricted'] as const
export const IDENTITY_CAPABILITIES = [
  'browse_public',
  'view_account',
  'edit_profile',
  'create_deposit_wallet',
  'deposit',
  'approve_tokens',
  'trade',
  'cancel_orders',
  'claim_or_redeem',
  'withdraw',
  'affiliate_claim',
  'sdk_api_keys',
  'create_market',
  'admin',
] as const
export const IDENTITY_ADMIN_PERMISSIONS = [
  'identity_configure',
  'identity_review',
  'identity_view_pii',
  'identity_export',
  'identity_delete',
  'identity_audit',
  'identity_manage_legal_hold',
  'identity_manage_permissions',
] as const

export const IDENTITY_ALWAYS_AVAILABLE_CAPABILITIES = new Set<string>([
  'browse_public',
  'view_account',
  'edit_profile',
  'cancel_orders',
  'claim_or_redeem',
  'withdraw',
] as const)

export const IDENTITY_DEFAULT_RETENTION_DAYS = 30
export const IDENTITY_MAX_RETENTION_DAYS = 3650
export const IDENTITY_MAX_FIELDS_PER_VERSION = 100
export const IDENTITY_MAX_OPTIONS_PER_FIELD = 250
export const IDENTITY_MAX_VALUE_BYTES = 16 * 1024
export const IDENTITY_MAX_PROVIDER_PAYLOAD_BYTES = 256 * 1024
export const IDENTITY_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const IDENTITY_GENERIC_WEBHOOK_ADAPTER = 'generic_webhook'
export const IDENTITY_DEFAULT_CONSENT_PLACEHOLDER = 'I consent to the processing of these data for identity verification.'
