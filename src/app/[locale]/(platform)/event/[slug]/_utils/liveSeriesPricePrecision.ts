export function resolveLiveSeriesTopicPriceDigits(topic: string) {
  return topic.trim().toLowerCase() === 'equity_prices' ? 2 : 4
}

function resolveAdaptiveCryptoPriceDigits(referencePrice?: number | null) {
  const numericPrice = Number(referencePrice)
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return 4
  }

  if (Math.abs(numericPrice) >= 10) {
    return 2
  }

  return 4
}

export function resolveLiveSeriesPriceDisplayDigits(
  topic: string,
  showPriceDecimals: boolean,
  referencePrice?: number | null,
) {
  const isEquityTopic = topic.trim().toLowerCase() === 'equity_prices'
  if (isEquityTopic) {
    return showPriceDecimals ? 2 : 0
  }

  return resolveAdaptiveCryptoPriceDigits(referencePrice)
}

export function resolveLiveSeriesDeltaDisplayDigits(
  priceDisplayDigits: number,
  delta?: number | null,
) {
  const normalizedDigits = Number.isFinite(priceDisplayDigits)
    ? Math.max(0, Math.floor(priceDisplayDigits))
    : 2

  const absDelta = Math.abs(Number(delta))
  if (Number.isFinite(absDelta) && absDelta > 1) {
    return 0
  }

  return Math.max(2, normalizedDigits)
}
