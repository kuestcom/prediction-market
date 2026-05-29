export type LimitExpirationOption = 'never' | '5m' | '1h' | '12h' | '24h' | 'end-of-day' | 'custom'

const EXPIRATION_DURATION_SECONDS: Record<Extract<LimitExpirationOption, '5m' | '1h' | '12h' | '24h'>, number> = {
  '5m': 5 * 60,
  '1h': 60 * 60,
  '12h': 12 * 60 * 60,
  '24h': 24 * 60 * 60,
}

export function resolveValidCustomExpirationTimestamp(params: {
  limitExpirationOption: LimitExpirationOption
  limitExpirationTimestamp: number | null | undefined
  nowSeconds: number
}) {
  const { limitExpirationOption, limitExpirationTimestamp, nowSeconds } = params

  if (limitExpirationOption !== 'custom') {
    return null
  }

  if (
    !limitExpirationTimestamp
    || !Number.isFinite(limitExpirationTimestamp)
    || limitExpirationTimestamp <= 0
  ) {
    return null
  }

  return limitExpirationTimestamp > nowSeconds
    ? limitExpirationTimestamp
    : null
}

export function resolveEndOfDayTimestamp(nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1000)
  const endOfDay = new Date(nowMs)
  endOfDay.setHours(23, 59, 59, 0)

  let timestampSeconds = Math.floor(endOfDay.getTime() / 1000)
  if (timestampSeconds <= nowSeconds) {
    endOfDay.setDate(endOfDay.getDate() + 1)
    endOfDay.setHours(23, 59, 59, 0)
    timestampSeconds = Math.floor(endOfDay.getTime() / 1000)
  }

  return timestampSeconds
}

export function resolveOrderExpirationTimestamp(params: {
  limitExpirationOption: LimitExpirationOption
  limitExpirationTimestamp: number | null | undefined
  nowMs?: number
}) {
  const {
    limitExpirationOption,
    limitExpirationTimestamp,
    nowMs = Date.now(),
  } = params
  const nowSeconds = Math.floor(nowMs / 1000)

  if (limitExpirationOption === 'never') {
    return null
  }

  if (limitExpirationOption === 'custom') {
    return resolveValidCustomExpirationTimestamp({
      limitExpirationOption,
      limitExpirationTimestamp,
      nowSeconds,
    })
  }

  if (limitExpirationOption === 'end-of-day') {
    return resolveEndOfDayTimestamp(nowMs)
  }

  return nowSeconds + EXPIRATION_DURATION_SECONDS[limitExpirationOption]
}
