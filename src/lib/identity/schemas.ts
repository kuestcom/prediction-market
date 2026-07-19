import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import {
  IDENTITY_ALWAYS_AVAILABLE_CAPABILITIES,
  IDENTITY_CAPABILITIES,
  IDENTITY_DECISION_POLICIES,
  IDENTITY_DEFAULT_CONSENT_PLACEHOLDER,
  IDENTITY_DEFAULT_RETENTION_DAYS,
  IDENTITY_EVIDENCE_LEVELS,
  IDENTITY_FIELD_TYPES,
  IDENTITY_MAX_DOCUMENT_BYTES,
  IDENTITY_MAX_FIELDS_PER_VERSION,
  IDENTITY_MAX_OPTIONS_PER_FIELD,
  IDENTITY_MAX_RETENTION_DAYS,
  IDENTITY_PROGRAM_MODES,
  IDENTITY_SENSITIVITY_LEVELS,
  IDENTITY_STORAGE_MODES,
} from './constants'
import { isSafeIdentityPattern } from './safe-pattern'

const keySchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/)
const localeSchema = z.enum(SUPPORTED_LOCALES)
const countryCodeSchema = z.string().trim().regex(/^[A-Z]{2}$/).refine(value => !['XX', 'T1'].includes(value))
const safeValidatorKeySchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/)

export const IdentityAccessPolicySchema = z.object({
  restrictedCapabilities: z.array(z.enum(IDENTITY_CAPABILITIES)).max(IDENTITY_CAPABILITIES.length),
  alwaysAllowedCapabilities: z.array(z.enum(IDENTITY_CAPABILITIES)).max(IDENTITY_CAPABILITIES.length),
  gracePeriodDays: z.number().int().min(0).max(365),
  approvalValidityDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS).nullable(),
  blockExistingUsers: z.boolean(),
}).strict().superRefine((value, context) => {
  if (new Set(value.restrictedCapabilities).size !== value.restrictedCapabilities.length) {
    context.addIssue({ code: 'custom', path: ['restrictedCapabilities'], message: 'Restricted capabilities must be unique.' })
  }
  if (new Set(value.alwaysAllowedCapabilities).size !== value.alwaysAllowedCapabilities.length) {
    context.addIssue({ code: 'custom', path: ['alwaysAllowedCapabilities'], message: 'Always-allowed capabilities must be unique.' })
  }
  for (const capability of IDENTITY_ALWAYS_AVAILABLE_CAPABILITIES) {
    if (!value.alwaysAllowedCapabilities.includes(capability as (typeof IDENTITY_CAPABILITIES)[number])) {
      context.addIssue({
        code: 'custom',
        path: ['alwaysAllowedCapabilities'],
        message: `${capability} must remain available so users can manage funds, orders, and their account.`,
      })
    }
  }
  const alwaysAllowed = new Set(value.alwaysAllowedCapabilities)
  if (value.restrictedCapabilities.some(capability => alwaysAllowed.has(capability))) {
    context.addIssue({
      code: 'custom',
      path: ['restrictedCapabilities'],
      message: 'A capability cannot be both restricted and always allowed.',
    })
  }
})

export const IdentityRetentionPolicySchema = z.object({
  draftDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS),
  rejectedDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS),
  approvedDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS),
  expiredDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS),
  documentDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS),
  technicalEventDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS),
}).strict()

export const IdentityAssignmentRulesSchema = z.object({
  countries: z.array(countryCodeSchema).max(250),
  minimumAge: z.number().int().min(0).max(150).nullable(),
  maximumAge: z.number().int().min(0).max(150).nullable(),
  providerConfigId: z.string().length(26).nullable(),
  fallbackProviderConfigIds: z.array(z.string().length(26)).max(5).default([]),
  consent: z.object({
    key: keySchema,
    documentVersion: z.string().trim().min(1).max(64),
    contentByLocale: z.partialRecord(localeSchema, z.string().trim().min(1).max(20_000)),
  }).strict().nullable(),
}).strict().superRefine((value, context) => {
  if (value.minimumAge !== null && value.maximumAge !== null && value.minimumAge > value.maximumAge) {
    context.addIssue({
      code: 'custom',
      path: ['maximumAge'],
      message: 'Maximum age must be greater than or equal to minimum age.',
    })
  }
})

export const IdentityFieldConfigSchema = z.object({
  minLength: z.number().int().min(0).max(16_000).optional(),
  maxLength: z.number().int().min(1).max(16_000).optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
  decimalPlaces: z.number().int().min(0).max(18).optional(),
  pattern: z.string().max(256).optional(),
  normalization: z.enum(['none', 'trim', 'lowercase', 'uppercase', 'digits_only', 'phone_e164']).optional(),
  displayMask: z.string().max(128).optional(),
  validatorKey: safeValidatorKeySchema.optional(),
  inputMode: z.enum(['text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url', 'none']).optional(),
  autocomplete: z.enum([
    'off',
    'name',
    'given-name',
    'family-name',
    'email',
    'tel',
    'street-address',
    'address-line1',
    'address-line2',
    'address-level1',
    'address-level2',
    'postal-code',
    'country',
    'bday',
  ]).optional(),
  minimumDate: z.string().date().optional(),
  maximumDate: z.string().date().optional(),
  minimumAge: z.number().int().min(0).max(150).optional(),
  maximumAge: z.number().int().min(0).max(150).optional(),
  maximumSelections: z.number().int().min(1).max(IDENTITY_MAX_OPTIONS_PER_FIELD).optional(),
  allowedContentTypes: z.array(z.enum(['image/jpeg', 'image/png', 'application/pdf'])).max(3).optional(),
  maximumFileBytes: z.number().int().min(1).max(IDENTITY_MAX_DOCUMENT_BYTES).optional(),
  maximumFiles: z.number().int().min(1).max(10).optional(),
  stripMetadata: z.boolean().optional(),
  conditionLogic: z.enum(['and', 'or']).optional(),
  addressParts: z.array(z.object({
    key: keySchema,
    required: z.boolean(),
    labels: z.partialRecord(localeSchema, z.string().trim().min(1).max(200)),
  }).strict()).min(1).max(20).optional(),
  consentTextByLocale: z.partialRecord(localeSchema, z.string().trim().min(1).max(2_000)).optional(),
  providerMapping: z.record(z.string().trim().min(1).max(64), z.string().trim().min(1).max(128)).optional(),
  purpose: z.string().trim().min(1).max(500).optional(),
  legalBasis: z.string().trim().min(1).max(500).optional(),
  adminVisibility: z.enum(['none', 'reviewers', 'pii_authorized']).optional(),
  retentionDays: z.number().int().min(1).max(IDENTITY_MAX_RETENTION_DAYS).optional(),
  duplicateDetection: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.minLength !== undefined && value.maxLength !== undefined && value.minLength > value.maxLength) {
    context.addIssue({ code: 'custom', path: ['maxLength'], message: 'Maximum length is lower than minimum length.' })
  }
  if (value.minimum !== undefined && value.maximum !== undefined && value.minimum > value.maximum) {
    context.addIssue({ code: 'custom', path: ['maximum'], message: 'Maximum value is lower than minimum value.' })
  }
  if (value.minimumDate && value.maximumDate && value.minimumDate > value.maximumDate) {
    context.addIssue({ code: 'custom', path: ['maximumDate'], message: 'Maximum date is earlier than minimum date.' })
  }
  if (value.minimumAge !== undefined && value.maximumAge !== undefined && value.minimumAge > value.maximumAge) {
    context.addIssue({ code: 'custom', path: ['maximumAge'], message: 'Maximum age is lower than minimum age.' })
  }
})

const IdentityFieldConditionSchema = z.object({
  fieldKey: keySchema,
  operator: z.enum(['equals', 'not_equals', 'in', 'exists']),
  value: z.unknown().optional(),
}).strict()

const IdentityFieldTranslationSchema = z.object({
  locale: localeSchema,
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000),
  helpText: z.string().trim().max(2_000),
  placeholder: z.string().trim().max(300),
}).strict()

export const IdentityFieldOptionSchema = z.object({
  id: z.string().length(26).optional(),
  valueKey: z.string().trim().regex(/^[a-z0-9][\w.:-]{0,127}$/i),
  displayOrder: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()),
  translations: z.array(z.object({
    locale: localeSchema,
    label: z.string().trim().min(1).max(200),
  }).strict()).min(1).max(SUPPORTED_LOCALES.length),
}).strict()

export const IdentityFieldSchema = z.object({
  id: z.string().length(26).optional(),
  key: keySchema,
  type: z.enum(IDENTITY_FIELD_TYPES),
  storageMode: z.enum(IDENTITY_STORAGE_MODES),
  sensitivity: z.enum(IDENTITY_SENSITIVITY_LEVELS),
  section: z.string().trim().min(1).max(64),
  displayOrder: z.number().int().min(0),
  required: z.boolean(),
  config: IdentityFieldConfigSchema,
  conditions: z.array(IdentityFieldConditionSchema).max(20),
  translations: z.array(IdentityFieldTranslationSchema).min(1).max(SUPPORTED_LOCALES.length),
  options: z.array(IdentityFieldOptionSchema).max(IDENTITY_MAX_OPTIONS_PER_FIELD),
}).strict().superRefine((field, context) => {
  const optionField = ['single_select', 'multi_select', 'radio'].includes(field.type)
  if (optionField && field.options.length === 0) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'This field type requires options.' })
  }
  if (!optionField && field.options.length > 0) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'This field type cannot have options.' })
  }
  if (['heading', 'paragraph', 'notice', 'separator'].includes(field.type) && field.storageMode !== 'derived_result_only') {
    context.addIssue({
      code: 'custom',
      path: ['storageMode'],
      message: 'Display-only fields must use derived_result_only storage.',
    })
  }
})

export const IdentityProgramVersionSchema = z.object({
  mode: z.enum(IDENTITY_PROGRAM_MODES),
  decisionPolicy: z.enum(IDENTITY_DECISION_POLICIES),
  requiredEvidence: z.enum(IDENTITY_EVIDENCE_LEVELS),
  assignmentRules: IdentityAssignmentRulesSchema,
  accessPolicy: IdentityAccessPolicySchema,
  retentionPolicy: IdentityRetentionPolicySchema,
  fields: z.array(IdentityFieldSchema).max(IDENTITY_MAX_FIELDS_PER_VERSION),
}).strict().superRefine((version, context) => {
  if (version.mode === 'self_hosted' && ['provider_decision', 'provider_plus_manual'].includes(version.decisionPolicy)) {
    context.addIssue({ code: 'custom', path: ['decisionPolicy'], message: 'This decision policy requires a provider.' })
  }
  if (version.mode !== 'self_hosted' && !version.assignmentRules.providerConfigId) {
    context.addIssue({ code: 'custom', path: ['assignmentRules', 'providerConfigId'], message: 'Provider is required.' })
  }
})

export const IdentityProgramSchema = z.object({
  id: z.string().length(26).optional(),
  key: keySchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000),
  version: IdentityProgramVersionSchema,
}).strict()

export const DEFAULT_IDENTITY_ACCESS_POLICY = IdentityAccessPolicySchema.parse({
  restrictedCapabilities: ['create_deposit_wallet', 'deposit', 'approve_tokens', 'trade', 'affiliate_claim', 'sdk_api_keys', 'create_market'],
  alwaysAllowedCapabilities: ['browse_public', 'view_account', 'edit_profile', 'cancel_orders', 'claim_or_redeem', 'withdraw'],
  gracePeriodDays: 0,
  approvalValidityDays: 365,
  blockExistingUsers: true,
})

export const DEFAULT_IDENTITY_RETENTION_POLICY = IdentityRetentionPolicySchema.parse({
  draftDays: IDENTITY_DEFAULT_RETENTION_DAYS,
  rejectedDays: 90,
  approvedDays: 365,
  expiredDays: 90,
  documentDays: 90,
  technicalEventDays: 90,
})

export function validateIdentityProgramForPublication(
  input: z.input<typeof IdentityProgramSchema>,
  enabledLocales: readonly string[],
) {
  const parsed = IdentityProgramSchema.safeParse(input)
  if (!parsed.success) {
    return parsed
  }

  const issues: z.core.$ZodIssue[] = []
  const fieldKeys = new Set(parsed.data.version.fields.map(field => field.key))
  const fieldOrder = new Map(parsed.data.version.fields.map(field => [field.key, field.displayOrder]))
  const graph = new Map<string, string[]>()

  parsed.data.version.fields.forEach((field, fieldIndex) => {
    const displayOnly = ['heading', 'paragraph', 'notice', 'separator'].includes(field.type)
    if (!displayOnly && field.storageMode === 'transient_forward_only') {
      issues.push({
        code: 'custom',
        path: ['version', 'fields', fieldIndex, 'storageMode'],
        message: 'Transient forwarding is not available for collected fields in this release.',
      })
    }
    if (!displayOnly && field.storageMode === 'derived_result_only') {
      issues.push({
        code: 'custom',
        path: ['version', 'fields', fieldIndex, 'storageMode'],
        message: 'Derived-result storage is only supported for display-only fields.',
      })
    }
    if (field.config.pattern && !isSafeIdentityPattern(field.config.pattern)) {
      issues.push({
        code: 'custom',
        path: ['version', 'fields', fieldIndex, 'config', 'pattern'],
        message: 'The validation pattern uses unsupported or potentially unsafe regular-expression features.',
      })
    }
    if (['file', 'document'].includes(field.type)
      && field.config.retentionDays
      && field.config.retentionDays > parsed.data.version.retentionPolicy.documentDays) {
      issues.push({
        code: 'custom',
        path: ['version', 'fields', fieldIndex, 'config', 'retentionDays'],
        message: 'Document field retention cannot exceed the program document-retention period.',
      })
    }
    if (!displayOnly && (!field.config.purpose || !field.config.legalBasis || !field.config.adminVisibility || !field.config.retentionDays)) {
      issues.push({
        code: 'custom',
        path: ['version', 'fields', fieldIndex, 'config'],
        message: 'Every collected field requires a purpose, operator-defined legal basis, administrative visibility, and retention period.',
      })
    }
    const translationLocales = new Set(field.translations.map(translation => translation.locale))
    for (const locale of enabledLocales) {
      if (!translationLocales.has(locale as (typeof SUPPORTED_LOCALES)[number])) {
        issues.push({
          code: 'custom',
          path: ['version', 'fields', fieldIndex, 'translations'],
          message: `Missing ${locale} field translation.`,
        })
      }
    }

    const dependencies: string[] = []
    field.conditions.forEach((condition, conditionIndex) => {
      if (!fieldKeys.has(condition.fieldKey)) {
        issues.push({
          code: 'custom',
          path: ['version', 'fields', fieldIndex, 'conditions', conditionIndex, 'fieldKey'],
          message: 'Conditional field does not exist in this version.',
        })
      }
      if (condition.fieldKey === field.key) {
        issues.push({
          code: 'custom',
          path: ['version', 'fields', fieldIndex, 'conditions', conditionIndex, 'fieldKey'],
          message: 'A field cannot depend on itself.',
        })
      }
      const controllerOrder = fieldOrder.get(condition.fieldKey)
      if (controllerOrder !== undefined && controllerOrder >= field.displayOrder) {
        issues.push({
          code: 'custom',
          path: ['version', 'fields', fieldIndex, 'conditions', conditionIndex, 'fieldKey'],
          message: 'A conditional field must depend on a field displayed earlier in the form.',
        })
      }
      dependencies.push(condition.fieldKey)
    })
    graph.set(field.key, dependencies)

    field.options.forEach((option, optionIndex) => {
      const translationLocales = new Set(option.translations.map(translation => translation.locale))
      for (const locale of enabledLocales) {
        if (!translationLocales.has(locale as (typeof SUPPORTED_LOCALES)[number])) {
          issues.push({
            code: 'custom',
            path: ['version', 'fields', fieldIndex, 'options', optionIndex, 'translations'],
            message: `Missing ${locale} option translation.`,
          })
        }
      }
    })
  })

  if (parsed.data.version.decisionPolicy === 'auto_on_valid_submission'
    && parsed.data.version.requiredEvidence !== 'self_declared') {
    issues.push({
      code: 'custom',
      path: ['version', 'requiredEvidence'],
      message: 'Automatic approval can only use self-declared evidence.',
    })
  }

  const assignment = parsed.data.version.assignmentRules
  if (assignment.minimumAge !== null || assignment.maximumAge !== null) {
    const hasEnforcedBirthDate = parsed.data.version.fields.some(field => (
      field.type === 'date'
      && field.storageMode === 'local_encrypted'
      && field.required
      && field.conditions.length === 0
      && (assignment.minimumAge === null
        || (field.config.minimumAge !== undefined && field.config.minimumAge >= assignment.minimumAge))
      && (assignment.maximumAge === null
        || (field.config.maximumAge !== undefined && field.config.maximumAge <= assignment.maximumAge))
    ))
    if (!hasEnforcedBirthDate) {
      issues.push({
        code: 'custom',
        path: ['version', 'assignmentRules'],
        message: 'Program age limits require an unconditional, required date field with matching age validation.',
      })
    }
  }

  const consent = parsed.data.version.assignmentRules.consent
  if (!consent) {
    issues.push({ code: 'custom', path: ['version', 'assignmentRules', 'consent'], message: 'Consent text is required.' })
  }
  else {
    for (const locale of enabledLocales) {
      const content = consent.contentByLocale[locale as (typeof SUPPORTED_LOCALES)[number]]
      if (!content) {
        issues.push({ code: 'custom', path: ['version', 'assignmentRules', 'consent', 'contentByLocale'], message: `Missing ${locale} consent text.` })
      }
      else if (content === IDENTITY_DEFAULT_CONSENT_PLACEHOLDER) {
        issues.push({ code: 'custom', path: ['version', 'assignmentRules', 'consent', 'contentByLocale', locale], message: `Replace the ${locale} consent placeholder with approved legal text.` })
      }
    }
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()
  function visit(key: string): boolean {
    if (visiting.has(key)) {
      return true
    }
    if (visited.has(key)) {
      return false
    }
    visiting.add(key)
    const cyclic = (graph.get(key) ?? []).some(visit)
    visiting.delete(key)
    visited.add(key)
    return cyclic
  }

  if ([...graph.keys()].some(visit)) {
    issues.push({ code: 'custom', path: ['version', 'fields'], message: 'Conditional field cycle detected.' })
  }

  if (issues.length > 0) {
    return { success: false as const, error: new z.ZodError(issues) }
  }

  return parsed
}
