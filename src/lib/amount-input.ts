const INTEGER_FORMATTER = new Intl.NumberFormat('en-US')

export const MAX_AMOUNT_INPUT = 999_999_999
const MAX_WHOLE_DIGITS = String(MAX_AMOUNT_INPUT).length

export function sanitizeNumericInput(rawValue: string) {
  const digitsAndDots = rawValue.replace(/[^0-9.]/g, '')
  const [wholePart, ...decimalSegments] = digitsAndDots.split('.')
  const limitedWhole = wholePart.slice(0, MAX_WHOLE_DIGITS)

  if (decimalSegments.length === 0) {
    return limitedWhole
  }

  const decimals = decimalSegments.join('').slice(0, 2)
  return `${limitedWhole}.${decimals}`
}

export function formatDisplayAmount(rawAmount: string) {
  if (!rawAmount) {
    return ''
  }

  const hasDecimalPoint = rawAmount.includes('.')
  const [wholePart = '', fractionPart = ''] = rawAmount.split('.')
  const normalizedWhole = Number.parseInt(wholePart || '0', 10)
  const formattedWhole = Number.isNaN(normalizedWhole) ? '0' : INTEGER_FORMATTER.format(normalizedWhole)

  if (!hasDecimalPoint) {
    return formattedWhole
  }

  if (rawAmount.endsWith('.') && fractionPart === '') {
    return `${formattedWhole}.`
  }

  return `${formattedWhole}.${fractionPart}`
}

interface AmountSizeClassOptions {
  large?: string
  medium?: string
  small?: string
}

export function getAmountSizeClass(rawAmount: string, options?: AmountSizeClassOptions) {
  const [rawWholePart = ''] = rawAmount.split('.')
  const normalizedWholePart = rawWholePart.replace(/^0+/, '')
  const digitCount = normalizedWholePart.length
  const largeClass = options?.large ?? 'text-4xl'
  const mediumClass = options?.medium ?? 'text-3xl'
  const smallClass = options?.small ?? 'text-2xl'

  if (digitCount >= 9) {
    return smallClass
  }

  if (digitCount >= 7) {
    return mediumClass
  }

  return largeClass
}
