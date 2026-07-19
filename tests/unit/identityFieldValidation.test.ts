import type { IdentityFieldInput } from '@/lib/identity/types'
import { describe, expect, it } from 'vitest'
import { isIdentityFieldVisible, isSafeIdentityPattern, validateIdentityFieldValue } from '@/lib/identity/field-validation'

function field(patch: Partial<IdentityFieldInput> = {}): IdentityFieldInput {
  return {
    key: 'national_id',
    type: 'national_identifier',
    storageMode: 'local_encrypted',
    sensitivity: 'restricted',
    section: 'identity',
    displayOrder: 0,
    required: true,
    config: { normalization: 'digits_only', purpose: 'Identity', retentionDays: 90 },
    conditions: [],
    translations: [{ locale: 'en', label: 'National ID', description: '', helpText: '', placeholder: '' }],
    options: [],
    ...patch,
  }
}

describe('identity field validation', () => {
  it('validates and normalizes a Brazilian CPF through a trusted versioned validator', () => {
    const result = validateIdentityFieldValue(field({ config: {
      normalization: 'digits_only',
      validatorKey: 'br_cpf_v1',
      purpose: 'Identity',
      retentionDays: 90,
    } }), '529.982.247-25')
    expect(result).toEqual({ value: '52998224725', normalizedText: '52998224725', error: null })
    expect(validateIdentityFieldValue(field({ config: {
      normalization: 'digits_only',
      validatorKey: 'br_cpf_v1',
      purpose: 'Identity',
      retentionDays: 90,
    } }), '111.111.111-11').error).toBe('FIELD_CHECKSUM_INVALID')
  })

  it('preserves large integers and precise decimals as canonical strings', () => {
    expect(validateIdentityFieldValue(field({ type: 'integer' }), '900719925474099312345').value)
      .toBe('900719925474099312345')
    expect(validateIdentityFieldValue(field({ type: 'decimal', config: { decimalPlaces: 4, purpose: 'Test', retentionDays: 30 } }), '0.1234').value)
      .toBe('0.1234')
  })

  it('rejects unsafe regular expressions and invalid selections', () => {
    expect(isSafeIdentityPattern('(a+)+$')).toBe(false)
    expect(validateIdentityFieldValue(field({ config: { pattern: '(a+)+$', purpose: 'Test', retentionDays: 30 } }), 'aaaa').error)
      .toBe('FIELD_PATTERN_UNSAFE')
    expect(validateIdentityFieldValue(field({
      type: 'single_select',
      options: [{ valueKey: 'yes', displayOrder: 0, config: {}, translations: [{ locale: 'en', label: 'Yes' }] }],
    }), 'no').error).toBe('FIELD_OPTION_INVALID')
  })

  it('uses UTC calendar boundaries for age validation', () => {
    const result = validateIdentityFieldValue(field({
      type: 'date',
      config: { minimumAge: 18, purpose: 'Age gate', retentionDays: 30 },
    }), '2008-07-19', new Date('2026-07-18T23:59:59.000Z'))
    expect(result.error).toBe('FIELD_MINIMUM_AGE')
  })

  it('validates configurable address composition and OR conditions', () => {
    const addressField = field({
      type: 'address',
      config: {
        purpose: 'Address',
        retentionDays: 30,
        addressParts: [
          { key: 'postal_code', required: true, labels: { en: 'Postal code' } },
          { key: 'region', required: false, labels: { en: 'Region' } },
        ],
      },
    })
    expect(validateIdentityFieldValue(addressField, { postal_code: '01001-000' }).error).toBeNull()
    expect(validateIdentityFieldValue(addressField, { region: 'SP' }).error).toBe('FIELD_ADDRESS_INVALID')
    expect(validateIdentityFieldValue(addressField, { postal_code: '01001-000', unexpected: 'x' }).error).toBe('FIELD_ADDRESS_INVALID')

    const conditional = field({
      config: { purpose: 'Conditional', retentionDays: 30, conditionLogic: 'or' },
      conditions: [
        { fieldKey: 'country', operator: 'equals', value: 'BR' },
        { fieldKey: 'citizenship', operator: 'equals', value: 'BR' },
      ],
    })
    expect(isIdentityFieldVisible(conditional, { country: 'US', citizenship: 'BR' })).toBe(true)
    expect(isIdentityFieldVisible(conditional, { country: 'US', citizenship: 'US' })).toBe(false)
  })
})
