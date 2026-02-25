import { formatCentsLabel, formatPercent } from '@/lib/formatters'

export type OddsFormat
  = | 'price'
    | 'american'
    | 'decimal'
    | 'fractional'
    | 'percentage'
    | 'indonesian'
    | 'hongkong'
    | 'malaysian'

export const ODDS_FORMAT_OPTIONS: Array<{ value: OddsFormat, label: string }> = [
  { value: 'price', label: 'Price' },
  { value: 'american', label: 'American' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'fractional', label: 'Fractional' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'indonesian', label: 'Indonesian' },
  { value: 'hongkong', label: 'Hong Kong' },
  { value: 'malaysian', label: 'Malaysian' },
]

function clampProbability(value: number) {
  return Math.max(0.0001, Math.min(0.9999, value))
}

function formatFixed(value: number, digits: number) {
  const rounded = Number(value.toFixed(digits))
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

function formatSigned(value: number, digits: number) {
  const absolute = Math.abs(value)
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatFixed(absolute, digits)}`
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)

  while (y) {
    const tmp = y
    y = x % y
    x = tmp
  }

  return x || 1
}

function toFractionString(value: number) {
  const target = Math.max(0, value)
  if (target === 0) {
    return '0/1'
  }

  let bestNumerator = 1
  let bestDenominator = 1
  let bestError = Number.POSITIVE_INFINITY
  const maxDenominator = 1000

  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(target * denominator)
    const approximation = numerator / denominator
    const error = Math.abs(target - approximation)

    if (error < bestError) {
      bestError = error
      bestNumerator = numerator
      bestDenominator = denominator
      if (error <= 1e-6) {
        break
      }
    }
  }

  const divisor = greatestCommonDivisor(bestNumerator, bestDenominator)
  return `${Math.max(1, Math.round(bestNumerator / divisor))}/${Math.max(1, Math.round(bestDenominator / divisor))}`
}

export function normalizeProbabilityFromPrice(value: number | null | undefined) {
  if (value == null) {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  if (numeric <= 1) {
    return clampProbability(numeric)
  }

  if (numeric <= 100) {
    return clampProbability(numeric / 100)
  }

  return null
}

export function formatOddsFromProbability(probability: number | null | undefined, oddsFormat: OddsFormat) {
  if (probability == null || !Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return '—'
  }

  const normalizedProbability = clampProbability(probability)
  const decimalOdds = 1 / normalizedProbability
  const hongKongOdds = decimalOdds - 1
  const americanOdds = decimalOdds >= 2
    ? (decimalOdds - 1) * 100
    : -100 / (decimalOdds - 1)

  switch (oddsFormat) {
    case 'price':
      return formatCentsLabel(normalizedProbability, { fallback: '—' })
    case 'american':
      return formatSigned(americanOdds, 0)
    case 'decimal':
      return formatFixed(decimalOdds, 3)
    case 'fractional':
      return toFractionString(hongKongOdds)
    case 'percentage':
      return formatPercent(normalizedProbability * 100, { digits: 1, includeSymbol: true })
    case 'hongkong':
      return formatFixed(hongKongOdds, 3)
    case 'indonesian': {
      const value = decimalOdds >= 2 ? decimalOdds - 1 : -1 / (decimalOdds - 1)
      return formatSigned(value, 3)
    }
    case 'malaysian': {
      const value = decimalOdds >= 2 ? 1 / (decimalOdds - 1) : -(decimalOdds - 1)
      return formatSigned(value, 3)
    }
    default:
      return formatCentsLabel(normalizedProbability, { fallback: '—' })
  }
}

export function formatOddsFromPrice(value: number | null | undefined, oddsFormat: OddsFormat) {
  const probability = normalizeProbabilityFromPrice(value)
  return formatOddsFromProbability(probability, oddsFormat)
}

export function formatOddsFromCents(value: number | null | undefined, oddsFormat: OddsFormat) {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  return formatOddsFromPrice(value, oddsFormat)
}
