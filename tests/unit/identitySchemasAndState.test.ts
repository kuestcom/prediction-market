import type { IdentityProgramInput } from '@/lib/identity/types'
import { describe, expect, it } from 'vitest'
import { IDENTITY_DEFAULT_CONSENT_PLACEHOLDER } from '@/lib/identity/constants'
import { canStartIdentityProviderSession, resolveIdentityLocalFinalizationStatus } from '@/lib/identity/lifecycle'
import {
  DEFAULT_IDENTITY_ACCESS_POLICY,
  DEFAULT_IDENTITY_RETENTION_POLICY,
  IdentityAccessPolicySchema,
  validateIdentityProgramForPublication,
} from '@/lib/identity/schemas'
import { canTransitionIdentityStatus } from '@/lib/identity/state-machine'

function program(): IdentityProgramInput {
  return {
    key: 'basic_identity',
    name: 'Basic identity',
    description: 'Identity program',
    version: {
      mode: 'self_hosted',
      decisionPolicy: 'manual_review',
      requiredEvidence: 'self_declared',
      assignmentRules: {
        countries: ['BR'],
        minimumAge: null,
        maximumAge: null,
        providerConfigId: null,
        fallbackProviderConfigIds: [],
        consent: { key: 'identity_consent', documentVersion: '1', contentByLocale: { en: 'Approved consent text.' } },
      },
      accessPolicy: DEFAULT_IDENTITY_ACCESS_POLICY,
      retentionPolicy: DEFAULT_IDENTITY_RETENTION_POLICY,
      fields: [{
        key: 'full_name',
        type: 'short_text',
        storageMode: 'local_encrypted',
        sensitivity: 'personal',
        section: 'identity',
        displayOrder: 0,
        required: true,
        config: { purpose: 'Identity matching', legalBasis: 'Operator-approved policy', adminVisibility: 'pii_authorized', retentionDays: 90 },
        conditions: [],
        translations: [{ locale: 'en', label: 'Full name', description: '', helpText: '', placeholder: '' }],
        options: [],
      }],
    },
  }
}

describe('identity publication and state machine', () => {
  it('accepts a complete country-neutral dynamic schema', () => {
    expect(validateIdentityProgramForPublication(program(), ['en']).success).toBe(true)
  })

  it('blocks consent placeholders, missing field purpose/retention, and condition cycles', () => {
    const placeholder = program()
    placeholder.version.assignmentRules.consent!.contentByLocale.en = IDENTITY_DEFAULT_CONSENT_PLACEHOLDER
    expect(validateIdentityProgramForPublication(placeholder, ['en']).success).toBe(false)

    const missingPurpose = program()
    missingPurpose.version.fields[0]!.config = {}
    expect(validateIdentityProgramForPublication(missingPurpose, ['en']).success).toBe(false)

    const cyclic = program()
    cyclic.version.fields.push({
      ...cyclic.version.fields[0]!,
      key: 'other_name',
      displayOrder: 1,
      conditions: [{ fieldKey: 'full_name', operator: 'exists' }],
    })
    cyclic.version.fields[0]!.conditions = [{ fieldKey: 'other_name', operator: 'exists' }]
    expect(validateIdentityProgramForPublication(cyclic, ['en']).success).toBe(false)
  })

  it('blocks configurations whose collected values would be discarded or validated too late', () => {
    const transient = program()
    transient.version.fields[0]!.storageMode = 'transient_forward_only'
    expect(validateIdentityProgramForPublication(transient, ['en']).success).toBe(false)

    const derivedInput = program()
    derivedInput.version.fields[0]!.storageMode = 'derived_result_only'
    expect(validateIdentityProgramForPublication(derivedInput, ['en']).success).toBe(false)

    const lateController = program()
    lateController.version.fields.push({
      ...lateController.version.fields[0]!,
      key: 'country_detail',
      displayOrder: 0,
      conditions: [{ fieldKey: 'full_name', operator: 'exists' }],
    })
    lateController.version.fields[0]!.displayOrder = 1
    expect(validateIdentityProgramForPublication(lateController, ['en']).success).toBe(false)

    const unsafePattern = program()
    unsafePattern.version.fields[0]!.config.pattern = '^(a+)+$'
    expect(validateIdentityProgramForPublication(unsafePattern, ['en']).success).toBe(false)
  })

  it('requires enforceable age gates and evidence compatible with automatic approval', () => {
    const missingAgeField = program()
    missingAgeField.version.assignmentRules.minimumAge = 18
    expect(validateIdentityProgramForPublication(missingAgeField, ['en']).success).toBe(false)

    const enforcedAge = program()
    enforcedAge.version.assignmentRules.minimumAge = 18
    enforcedAge.version.fields.push({
      ...enforcedAge.version.fields[0]!,
      key: 'birth_date',
      type: 'date',
      displayOrder: 1,
      config: {
        ...enforcedAge.version.fields[0]!.config,
        minimumAge: 18,
      },
    })
    expect(validateIdentityProgramForPublication(enforcedAge, ['en']).success).toBe(true)

    const automaticDocumentApproval = program()
    automaticDocumentApproval.version.decisionPolicy = 'auto_on_valid_submission'
    automaticDocumentApproval.version.requiredEvidence = 'document_submitted'
    expect(validateIdentityProgramForPublication(automaticDocumentApproval, ['en']).success).toBe(false)
  })

  it('keeps safety capabilities available and disjoint from restrictions', () => {
    expect(IdentityAccessPolicySchema.safeParse({
      ...DEFAULT_IDENTITY_ACCESS_POLICY,
      alwaysAllowedCapabilities: DEFAULT_IDENTITY_ACCESS_POLICY.alwaysAllowedCapabilities.filter(capability => capability !== 'withdraw'),
    }).success).toBe(false)
    expect(IdentityAccessPolicySchema.safeParse({
      ...DEFAULT_IDENTITY_ACCESS_POLICY,
      restrictedCapabilities: [...DEFAULT_IDENTITY_ACCESS_POLICY.restrictedCapabilities, 'withdraw'],
    }).success).toBe(false)
  })

  it('allows expected review transitions and rejects unsafe shortcuts', () => {
    expect(canTransitionIdentityStatus('draft', 'under_review')).toBe(true)
    expect(canTransitionIdentityStatus('approved', 'suspended')).toBe(true)
    expect(canTransitionIdentityStatus('needs_resubmission', 'approved')).toBe(true)
    expect(canTransitionIdentityStatus('rejected', 'approved')).toBe(false)
    expect(canTransitionIdentityStatus('expired', 'approved')).toBe(false)
  })

  it('requires local hybrid evidence before starting its provider stage', () => {
    expect(resolveIdentityLocalFinalizationStatus({
      mode: 'hybrid',
      decisionPolicy: 'auto_on_valid_submission',
      requiredEvidence: 'provider_verified',
    })).toBe('pending')
    expect(canStartIdentityProviderSession('hybrid', 'draft')).toBe(false)
    expect(canStartIdentityProviderSession('hybrid', 'pending')).toBe(true)
    expect(canStartIdentityProviderSession('provider', 'draft')).toBe(true)
    expect(canStartIdentityProviderSession('self_hosted', 'pending')).toBe(false)
  })
})
