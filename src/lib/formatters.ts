import { MICRO_UNIT } from '@/lib/constants'

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_CURRENCY = 'USD'

export const priceFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export const sharesFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const usdFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const SHARES_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>([
  ['0-2', sharesFormatter],
])

const USD_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>([
  ['2-2', usdFormatter],
])

function getSharesFormatter(min: number, max: number) {
  const key = `${min}-${max}`
  const cached = SHARES_FORMATTER_CACHE.get(key)
  if (cached) {
    return cached
  }

  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
  SHARES_FORMATTER_CACHE.set(key, formatter)
  return formatter
}

interface SharesFormatOptions {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatSharesLabel(value: number, options: SharesFormatOptions = {}) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }

  const minimumFractionDigits = options.minimumFractionDigits ?? 0
  const maximumFractionDigits = options.maximumFractionDigits ?? Math.max(2, minimumFractionDigits)
  const normalizedMaxDigits = Math.max(maximumFractionDigits, minimumFractionDigits)
  const scale = 10 ** Math.max(0, normalizedMaxDigits)
  const truncated = Math.floor(value * scale + 1e-8) / scale
  const formatter = getSharesFormatter(
    minimumFractionDigits,
    normalizedMaxDigits,
  )
  return formatter.format(Math.max(0, truncated))
}

export function formatCompactShares(value: number) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000) {
    const scaled = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${scaled}M`
  }

  if (abs >= 1_000) {
    const scaled = (abs / 1_000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${scaled}k`
  }

  return `${sign}${formatSharesLabel(abs)}`
}

function getUsdFormatter(min: number, max: number) {
  const key = `${min}-${max}`
  const cached = USD_FORMATTER_CACHE.get(key)
  if (cached) {
    return cached
  }

  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
  USD_FORMATTER_CACHE.set(key, formatter)
  return formatter
}

interface CurrencyFormatOptions {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  includeSymbol?: boolean
}

export function formatCurrency(
  value: number | null | undefined,
  options: CurrencyFormatOptions = {},
) {
  const minimumFractionDigits = options.minimumFractionDigits ?? 2
  const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits
  const includeSymbol = options.includeSymbol ?? true
  const formatter = getUsdFormatter(minimumFractionDigits, maximumFractionDigits)
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0

  if (includeSymbol) {
    return formatter.format(safeValue)
  }

  return formatter
    .formatToParts(safeValue)
    .filter(part => part.type !== 'currency')
    .map(part => part.value)
    .join('')
    .trim()
}

interface PercentFormatOptions {
  digits?: number
  includeSymbol?: boolean
}

export function formatPercent(value: number, options: PercentFormatOptions = {}) {
  const digits = options.digits ?? 2
  const includeSymbol = options.includeSymbol ?? true
  const safeValue = Number.isFinite(value) ? value : 0
  const formatted = safeValue.toFixed(digits)
  return includeSymbol ? `${formatted}%` : formatted
}

export function formatVolume(volume: number): string {
  if (!Number.isFinite(volume) || volume < 0) {
    return '$0'
  }

  if (volume >= MICRO_UNIT) {
    return `$${(volume / MICRO_UNIT).toFixed(1)}M`
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(0)}k`
  }
  return `$${volume.toFixed(0)}`
}

const COMPACT_THRESHOLD = 100_000
const COMPACT_MILLION = 1_000_000

export function formatCompactCount(value: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const abs = Math.abs(value)
  if (abs >= COMPACT_MILLION) {
    const compact = (abs / COMPACT_MILLION).toFixed(1).replace(/\.0$/, '')
    return `${value < 0 ? '-' : ''}${compact}M`
  }
  if (abs >= COMPACT_THRESHOLD) {
    const compact = Math.round(abs / 1_000).toLocaleString(DEFAULT_LOCALE)
    return `${value < 0 ? '-' : ''}${compact}k`
  }

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const abs = Math.abs(value)
  if (abs >= COMPACT_MILLION) {
    const compact = (abs / COMPACT_MILLION).toFixed(1).replace(/\.0$/, '')
    return `${value < 0 ? '-' : ''}$${compact}M`
  }
  if (abs >= COMPACT_THRESHOLD) {
    const compact = Math.round(abs / 1_000).toLocaleString(DEFAULT_LOCALE)
    return `${value < 0 ? '-' : ''}$${compact}k`
  }

  return formatCurrency(value)
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(DEFAULT_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function normalizeDateString(value: string) {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2} /.test(trimmed)) {
    return trimmed.replace(' ', 'T')
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}Z`
  }
  return trimmed
}

export function formatTimeAgo(dateInput: string | number | Date) {
  let date: Date

  if (dateInput instanceof Date) {
    date = dateInput
  }
  else if (typeof dateInput === 'number') {
    date = new Date(dateInput)
  }
  else {
    const normalized = normalizeDateString(dateInput)
    date = new Date(normalized)
    if (Number.isNaN(date.getTime())) {
      const numeric = Number(dateInput)
      if (Number.isFinite(numeric)) {
        date = new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      }
    }
  }

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  }

  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`
  }

  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`
  }

  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export function truncateAddress(address: string) {
  if (!address) {
    return ''
  }
  return `${address.slice(0, 4)}…${address.slice(-6)}`
}

interface CentsFormatOptions {
  fallback?: string
}

export function formatCentsLabel(
  value: number | string | null | undefined,
  options: CentsFormatOptions = {},
) {
  const fallback = options.fallback ?? '—'
  if (value === null || value === undefined) {
    return fallback
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  if (numeric <= 1) {
    const cents = toCents(numeric)
    return cents === null ? fallback : `${priceFormatter.format(cents)}¢`
  }

  const cents = Number(numeric.toFixed(1))
  return `${priceFormatter.format(cents)}¢`
}

interface SharePriceFormatOptions extends CentsFormatOptions {
  currencyDigits?: number
}

export function formatSharePriceLabel(
  value: number | string | null | undefined,
  options: SharePriceFormatOptions = {},
) {
  const fallback = options.fallback ?? '50.0¢'

  if (value === null || value === undefined) {
    return fallback
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  if (numeric < 1) {
    return formatCentsLabel(toCents(numeric), { fallback })
  }

  const digits = options.currencyDigits ?? 2
  return formatCurrency(numeric, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function toCents(value?: string | number | null) {
  if (value === null || value === undefined) {
    return null
  }

  const numeric = typeof value === 'string' ? Number(value) : value
  const normalized = Number.isFinite(numeric)
    ? Math.min(Math.max(numeric, 0), 1)
    : 0.5

  return Number((normalized * 100).toFixed(1))
}

export function toMicro(amount: string | number): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return '0'
  }
  return Math.round(numeric * MICRO_UNIT).toString()
}

export function fromMicro(amount: string | number, precision: number = 1): string {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) {
    return (0).toFixed(precision)
  }
  return (numeric / MICRO_UNIT).toFixed(precision)
}

interface AmountInputFormatOptions {
  roundingMode?: 'round' | 'floor'
}

export function formatAmountInputValue(value: number, options: AmountInputFormatOptions = {}): string {
  if (!Number.isFinite(value)) {
    return ''
  }

  const roundingMode = options.roundingMode ?? 'round'
  const scaled = value * 100
  const roundedScaled = roundingMode === 'floor'
    ? Math.floor(scaled + 1e-8)
    : Math.round(scaled)
  const normalized = Math.max(0, roundedScaled / 100)
  if (normalized === 0) {
    return ''
  }

  if (Number.isInteger(normalized)) {
    return Math.trunc(normalized).toString()
  }

  return normalized.toFixed(2)
}
