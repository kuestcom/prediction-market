import type { IdentityProgramInput } from '@/lib/identity/types'
import { describe, expect, it } from 'vitest'
import { IDENTITY_DEFAULT_CONSENT_PLACEHOLDER } from '@/lib/identity/constants'
import {
  DEFAULT_IDENTITY_ACCESS_POLICY,
  DEFAULT_IDENTITY_RETENTION_POLICY,
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

  it('allows expected review transitions and rejects unsafe shortcuts', () => {
    expect(canTransitionIdentityStatus('draft', 'under_review')).toBe(true)
    expect(canTransitionIdentityStatus('approved', 'suspended')).toBe(true)
    expect(canTransitionIdentityStatus('rejected', 'approved')).toBe(false)
    expect(canTransitionIdentityStatus('expired', 'approved')).toBe(false)
  })
})
