import { SettingsRepository } from '@/lib/db/queries/settings'

const GENERAL_SETTINGS_GROUP = 'general'
export const BLOCKED_COUNTRIES_SETTINGS_KEY = 'blocked_countries'
const MAX_BLOCKED_COUNTRIES = 260

const COUNTRY_INPUT_SPLIT_PATTERN = /[\s,;]+/
const ALLOWED_COUNTRY_CODES = new Set([
  'AF',
  'AX',
  'AL',
  'DZ',
  'AS',
  'AD',
  'AO',
  'AI',
  'AQ',
  'AG',
  'AR',
  'AM',
  'AW',
  'AU',
  'AT',
  'AZ',
  'BS',
  'BH',
  'BD',
  'BB',
  'BY',
  'BE',
  'BZ',
  'BJ',
  'BM',
  'BT',
  'BO',
  'BQ',
  'BA',
  'BW',
  'BV',
  'BR',
  'IO',
  'BN',
  'BG',
  'BF',
  'BI',
  'KH',
  'CM',
  'CA',
  'CV',
  'KY',
  'CF',
  'TD',
  'CL',
  'CN',
  'CX',
  'CC',
  'CO',
  'KM',
  'CG',
  'CD',
  'CK',
  'CR',
  'CI',
  'HR',
  'CU',
  'CW',
  'CY',
  'CZ',
  'DK',
  'DJ',
  'DM',
  'DO',
  'EC',
  'EG',
  'SV',
  'GQ',
  'ER',
  'EE',
  'ET',
  'FK',
  'FO',
  'FJ',
  'FI',
  'FR',
  'GF',
  'PF',
  'TF',
  'GA',
  'GM',
  'GE',
  'DE',
  'GH',
  'GI',
  'GR',
  'GL',
  'GD',
  'GP',
  'GU',
  'GT',
  'GG',
  'GN',
  'GW',
  'GY',
  'HT',
  'HM',
  'VA',
  'HN',
  'HK',
  'HU',
  'IS',
  'IN',
  'ID',
  'IR',
  'IQ',
  'IE',
  'IM',
  'IL',
  'IT',
  'JM',
  'JP',
  'JE',
  'JO',
  'KZ',
  'KE',
  'KI',
  'KP',
  'KR',
  'KW',
  'KG',
  'LA',
  'LV',
  'LB',
  'LS',
  'LR',
  'LY',
  'LI',
  'LT',
  'LU',
  'MO',
  'MK',
  'MG',
  'MW',
  'MY',
  'MV',
  'ML',
  'MT',
  'MH',
  'MQ',
  'MR',
  'MU',
  'YT',
  'MX',
  'FM',
  'MD',
  'MC',
  'MN',
  'ME',
  'MS',
  'MA',
  'MZ',
  'MM',
  'NA',
  'NR',
  'NP',
  'NL',
  'NC',
  'NZ',
  'NI',
  'NE',
  'NG',
  'NU',
  'NF',
  'MP',
  'NO',
  'OM',
  'PK',
  'PW',
  'PS',
  'PA',
  'PG',
  'PY',
  'PE',
  'PH',
  'PN',
  'PL',
  'PT',
  'PR',
  'QA',
  'RE',
  'RO',
  'RU',
  'RW',
  'BL',
  'SH',
  'KN',
  'LC',
  'MF',
  'PM',
  'VC',
  'WS',
  'SM',
  'ST',
  'SA',
  'SN',
  'RS',
  'SC',
  'SL',
  'SG',
  'SX',
  'SK',
  'SI',
  'SB',
  'SO',
  'ZA',
  'GS',
  'SS',
  'ES',
  'LK',
  'SD',
  'SR',
  'SJ',
  'SZ',
  'SE',
  'CH',
  'SY',
  'TW',
  'TJ',
  'TZ',
  'TH',
  'TL',
  'TG',
  'TK',
  'TO',
  'TT',
  'TN',
  'TR',
  'TM',
  'TC',
  'TV',
  'UG',
  'UA',
  'AE',
  'GB',
  'US',
  'UM',
  'UY',
  'UZ',
  'VU',
  'VE',
  'VN',
  'VG',
  'VI',
  'WF',
  'EH',
  'YE',
  'ZM',
  'ZW',
  'XX',
  'T1',
])
const REQUEST_COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'] as const

type SettingsGroup = Record<string, { value: string, updated_at: string }>
interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

interface BlockedCountriesValidationResult {
  data: {
    blockedCountries: string[]
    blockedCountriesValue: string
  } | null
  error: string | null
}

function normalizeCountryCodes(codes: Iterable<string>) {
  const next: string[] = []
  const seen = new Set<string>()

  for (const code of codes) {
    const normalized = code.trim().toUpperCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    if (!ALLOWED_COUNTRY_CODES.has(normalized)) {
      return { data: null, error: `Invalid country code: ${normalized}.` as string }
    }

    seen.add(normalized)
    next.push(normalized)
  }

  if (next.length > MAX_BLOCKED_COUNTRIES) {
    return {
      data: null,
      error: `Blocked countries must contain ${MAX_BLOCKED_COUNTRIES} entries or less.`,
    }
  }

  return { data: next, error: null as string | null }
}

function parseBlockedCountriesFromSettingsValue(rawValue: string | null | undefined) {
  const normalizedRawValue = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!normalizedRawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(normalizedRawValue)
    if (!Array.isArray(parsed)) {
      return []
    }

    const normalized = normalizeCountryCodes(parsed.filter((entry): entry is string => typeof entry === 'string'))
    return normalized.data ?? []
  }
  catch {
    return []
  }
}

export function getBlockedCountriesFromSettings(settings?: SettingsMap) {
  const rawValue = settings?.[GENERAL_SETTINGS_GROUP]?.[BLOCKED_COUNTRIES_SETTINGS_KEY]?.value
  return parseBlockedCountriesFromSettingsValue(rawValue)
}

export async function loadBlockedCountries() {
  const { data } = await SettingsRepository.getSettings()
  return getBlockedCountriesFromSettings(data ?? undefined)
}

export function validateBlockedCountriesInput(rawValue: string | null | undefined): BlockedCountriesValidationResult {
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!normalizedValue) {
    return {
      data: {
        blockedCountries: [],
        blockedCountriesValue: '[]',
      },
      error: null,
    }
  }

  const normalized = normalizeCountryCodes(normalizedValue.split(COUNTRY_INPUT_SPLIT_PATTERN))
  if (normalized.error || !normalized.data) {
    return { data: null, error: normalized.error }
  }

  return {
    data: {
      blockedCountries: normalized.data,
      blockedCountriesValue: JSON.stringify(normalized.data),
    },
    error: null,
  }
}

export function getRequestCountryCode(headers: Headers) {
  for (const headerName of REQUEST_COUNTRY_HEADERS) {
    const value = headers.get(headerName)?.trim().toUpperCase()
    if (value && ALLOWED_COUNTRY_CODES.has(value)) {
      return value
    }
  }

  return null
}

export function isCountryBlocked(countryCode: string | null | undefined, blockedCountries: string[]) {
  if (!countryCode) {
    return false
  }

  return blockedCountries.includes(countryCode.toUpperCase())
}
