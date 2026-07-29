import { formatCurrency } from '@/lib/formatters'

export function formatSignedCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0
  const formatted = formatCurrency(Math.abs(safeValue), { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return safeValue >= 0 ? `+${formatted}` : `-${formatted}`
}

export function formatVolumeCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const safeValue = Math.abs(value)
  return formatCurrency(safeValue, {
    minimumFractionDigits: safeValue > 0 && safeValue < 1 ? 2 : 0,
    maximumFractionDigits: safeValue > 0 && safeValue < 1 ? 2 : 0,
  })
}

export function formatValueOrDash(value?: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatCurrency(value as number, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function getMedalProps(rankNumber: number) {
  const medalSrc =
    rankNumber === 1
      ? '/images/medals/gold.svg'
      : rankNumber === 2
        ? '/images/medals/silver.svg'
        : rankNumber === 3
          ? '/images/medals/bronze.svg'
          : null
  const medalAlt =
    rankNumber === 1 ? 'Gold medal' : rankNumber === 2 ? 'Silver medal' : rankNumber === 3 ? 'Bronze medal' : ''
  return { medalSrc, medalAlt }
}
