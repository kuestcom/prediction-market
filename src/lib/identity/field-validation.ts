import type { IdentityFieldInput, IdentityFieldOptionInput } from './types'
import { isDeepStrictEqual } from 'node:util'
import { IDENTITY_MAX_VALUE_BYTES } from './constants'
import { isSafeIdentityPattern } from './safe-pattern'
import { IdentityFieldConfigSchema } from './schemas'

export { isSafeIdentityPattern } from './safe-pattern'

export interface IdentityFieldValidationResult {
  value: unknown | null
  normalizedText: string | null
  error: string | null
}

type TrustedValidator = (value: string) => boolean

function validateBrazilianCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) {
    return false
  }

  function calculateDigit(length: number) {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(9) === Number(value[9]) && calculateDigit(10) === Number(value[10])
}

const TRUSTED_VALIDATORS: Readonly<Record<string, TrustedValidator>> = {
  br_cpf_v1: validateBrazilianCpf,
}

function normalizeText(value: string, normalization: string | undefined) {
  switch (normalization) {
    case 'trim':
      return value.trim()
    case 'lowercase':
      return value.trim().toLowerCase()
    case 'uppercase':
      return value.trim().toUpperCase()
    case 'digits_only':
      return value.replace(/\D/g, '')
    case 'phone_e164': {
      const normalized = value.trim().replace(/[\s().-]/g, '')
      return normalized.startsWith('+') ? normalized : `+${normalized}`
    }
    case 'none':
    default:
      return value
  }
}

function getAge(date: string, now: Date) {
  const birthday = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(birthday.getTime())) {
    return null
  }
  let age = now.getUTCFullYear() - birthday.getUTCFullYear()
  const month = now.getUTCMonth() - birthday.getUTCMonth()
  if (month < 0 || (month === 0 && now.getUTCDate() < birthday.getUTCDate())) {
    age -= 1
  }
  return age
}

function hasOption(options: IdentityFieldOptionInput[], value: string) {
  return options.some(option => option.valueKey === value)
}

function serializedSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

export function validateIdentityFieldValue(
  field: IdentityFieldInput,
  input: unknown,
  now = new Date(),
): IdentityFieldValidationResult {
  if (['heading', 'paragraph', 'notice', 'separator'].includes(field.type)) {
    return { value: null, normalizedText: null, error: null }
  }

  if (input === null || input === undefined || input === '') {
    return field.required
      ? { value: null, normalizedText: null, error: 'FIELD_REQUIRED' }
      : { value: null, normalizedText: null, error: null }
  }

  const parsedConfig = IdentityFieldConfigSchema.safeParse(field.config)
  if (!parsedConfig.success) {
    return { value: null, normalizedText: null, error: 'FIELD_CONFIGURATION_INVALID' }
  }
  const config = parsedConfig.data

  let value: unknown
  let normalizedText: string | null = null

  if (['short_text', 'long_text', 'phone', 'email', 'national_identifier', 'subdivision'].includes(field.type)) {
    if (typeof input !== 'string') {
      return { value: null, normalizedText: null, error: 'FIELD_TYPE_INVALID' }
    }
    normalizedText = normalizeText(input, config.normalization ?? 'trim')
    if (config.minLength !== undefined && normalizedText.length < config.minLength) {
      return { value: null, normalizedText, error: 'FIELD_TOO_SHORT' }
    }
    if (config.maxLength !== undefined && normalizedText.length > config.maxLength) {
      return { value: null, normalizedText, error: 'FIELD_TOO_LONG' }
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(normalizedText)) {
      return { value: null, normalizedText, error: 'FIELD_EMAIL_INVALID' }
    }
    if (field.type === 'phone' && !/^\+[1-9]\d{6,14}$/.test(normalizedText)) {
      return { value: null, normalizedText, error: 'FIELD_PHONE_INVALID' }
    }
    if (config.pattern) {
      if (!isSafeIdentityPattern(config.pattern)) {
        return { value: null, normalizedText, error: 'FIELD_PATTERN_UNSAFE' }
      }
      if (!new RegExp(config.pattern, 'u').test(normalizedText)) {
        return { value: null, normalizedText, error: 'FIELD_PATTERN_INVALID' }
      }
    }
    if (config.validatorKey) {
      const validator = TRUSTED_VALIDATORS[config.validatorKey]
      if (!validator || !validator(normalizedText)) {
        return { value: null, normalizedText, error: 'FIELD_CHECKSUM_INVALID' }
      }
    }
    value = normalizedText
  }
  else if (field.type === 'integer' || field.type === 'decimal') {
    const rawNumber = typeof input === 'number' ? String(input) : typeof input === 'string' ? input.trim() : ''
    const valid = field.type === 'integer'
      ? /^-?(?:0|[1-9]\d*)$/.test(rawNumber)
      : /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(rawNumber)
    if (!valid) {
      return { value: null, normalizedText: null, error: 'FIELD_NUMBER_INVALID' }
    }
    const comparable = Number(rawNumber)
    if (config.minimum !== undefined && (!Number.isFinite(comparable) || comparable < config.minimum)) {
      return { value: null, normalizedText: null, error: 'FIELD_NUMBER_TOO_LOW' }
    }
    if (config.maximum !== undefined && (!Number.isFinite(comparable) || comparable > config.maximum)) {
      return { value: null, normalizedText: null, error: 'FIELD_NUMBER_TOO_HIGH' }
    }
    if (config.decimalPlaces !== undefined) {
      const decimals = rawNumber.split('.')[1]?.length ?? 0
      if (decimals > config.decimalPlaces) {
        return { value: null, normalizedText: null, error: 'FIELD_DECIMAL_PLACES_INVALID' }
      }
    }
    value = rawNumber
    normalizedText = rawNumber
  }
  else if (field.type === 'boolean') {
    if (typeof input !== 'boolean') {
      return { value: null, normalizedText: null, error: 'FIELD_BOOLEAN_INVALID' }
    }
    value = input
    normalizedText = input ? 'true' : 'false'
  }
  else if (field.type === 'date') {
    if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(`${input}T00:00:00.000Z`))) {
      return { value: null, normalizedText: null, error: 'FIELD_DATE_INVALID' }
    }
    if (config.minimumDate && input < config.minimumDate) {
      return { value: null, normalizedText: input, error: 'FIELD_DATE_TOO_EARLY' }
    }
    if (config.maximumDate && input > config.maximumDate) {
      return { value: null, normalizedText: input, error: 'FIELD_DATE_TOO_LATE' }
    }
    const age = getAge(input, now)
    if (age === null || (config.minimumAge !== undefined && age < config.minimumAge)) {
      return { value: null, normalizedText: input, error: 'FIELD_MINIMUM_AGE' }
    }
    if (config.maximumAge !== undefined && age > config.maximumAge) {
      return { value: null, normalizedText: input, error: 'FIELD_MAXIMUM_AGE' }
    }
    value = input
    normalizedText = input
  }
  else if (['single_select', 'radio', 'country'].includes(field.type)) {
    if (typeof input !== 'string') {
      return { value: null, normalizedText: null, error: 'FIELD_SELECTION_INVALID' }
    }
    const selected = input.trim()
    if (field.type === 'country') {
      if (!/^[A-Z]{2}$/.test(selected) || ['XX', 'T1'].includes(selected)) {
        return { value: null, normalizedText: selected, error: 'FIELD_COUNTRY_INVALID' }
      }
    }
    else if (!hasOption(field.options, selected)) {
      return { value: null, normalizedText: selected, error: 'FIELD_OPTION_INVALID' }
    }
    value = selected
    normalizedText = selected
  }
  else if (field.type === 'multi_select') {
    if (!Array.isArray(input) || input.some(entry => typeof entry !== 'string')) {
      return { value: null, normalizedText: null, error: 'FIELD_SELECTION_INVALID' }
    }
    const selected = [...new Set(input as string[])]
    if (selected.some(entry => !hasOption(field.options, entry))) {
      return { value: null, normalizedText: null, error: 'FIELD_OPTION_INVALID' }
    }
    if (config.maximumSelections !== undefined && selected.length > config.maximumSelections) {
      return { value: null, normalizedText: null, error: 'FIELD_SELECTION_LIMIT' }
    }
    value = selected
    normalizedText = selected.join(',')
  }
  else if (field.type === 'address') {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { value: null, normalizedText: null, error: 'FIELD_ADDRESS_INVALID' }
    }
    const entries = Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    if (entries.length === 0 || entries.length !== Object.keys(input).length) {
      return { value: null, normalizedText: null, error: 'FIELD_ADDRESS_INVALID' }
    }
    const normalizedEntries = entries.map(([key, entryValue]) => [key, entryValue.trim()] as const)
    if (config.addressParts) {
      const allowed = new Set(config.addressParts.map(part => part.key))
      if (normalizedEntries.some(([key]) => !allowed.has(key))
        || config.addressParts.some(part => part.required && !normalizedEntries.some(([key, entryValue]) => key === part.key && entryValue))) {
        return { value: null, normalizedText: null, error: 'FIELD_ADDRESS_INVALID' }
      }
    }
    value = Object.fromEntries(normalizedEntries)
  }
  else {
    return { value: null, normalizedText: null, error: 'FIELD_REQUIRES_DOCUMENT_FLOW' }
  }

  if (serializedSize(value) > IDENTITY_MAX_VALUE_BYTES) {
    return { value: null, normalizedText, error: 'FIELD_VALUE_TOO_LARGE' }
  }

  return { value, normalizedText, error: null }
}

function isIdentityConditionSatisfied(condition: IdentityFieldInput['conditions'][number], answers: Record<string, unknown>) {
  const actual = answers[condition.fieldKey]
  switch (condition.operator) {
    case 'exists':
      return actual !== null && actual !== undefined && actual !== ''
    case 'equals':
      return isDeepStrictEqual(actual, condition.value)
    case 'not_equals':
      return !isDeepStrictEqual(actual, condition.value)
    case 'in':
      return Array.isArray(condition.value) && condition.value.some(entry => isDeepStrictEqual(actual, entry))
  }
}

export function isIdentityFieldVisible(field: IdentityFieldInput, answers: Record<string, unknown>) {
  const results = field.conditions.map(condition => isIdentityConditionSatisfied(condition, answers))
  return field.config.conditionLogic === 'or' ? results.some(Boolean) : results.every(Boolean)
}
