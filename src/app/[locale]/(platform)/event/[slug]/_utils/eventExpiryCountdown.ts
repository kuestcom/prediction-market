const MINUTE_MS = 60_000
const HOUR_IN_MINUTES = 60
const DAY_IN_MINUTES = 24 * HOUR_IN_MINUTES
const DETAILED_COUNTDOWN_LIMIT_DAYS = 7

export function formatEventExpiryCountdown(expiryTimestamp: number, currentTimestamp: number | null): string | null {
  if (!Number.isFinite(expiryTimestamp) || currentTimestamp === null || !Number.isFinite(currentTimestamp)) {
    return null
  }

  const remainingMs = Math.max(0, expiryTimestamp - currentTimestamp)
  const totalMinutes = remainingMs > 0 ? Math.ceil(remainingMs / MINUTE_MS) : 0
  const days = Math.floor(totalMinutes / DAY_IN_MINUTES)
  const hours = Math.floor((totalMinutes % DAY_IN_MINUTES) / HOUR_IN_MINUTES)
  const minutes = totalMinutes % HOUR_IN_MINUTES

  if (days >= DETAILED_COUNTDOWN_LIMIT_DAYS) {
    return `${days}d`
  }

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return `${minutes}m`
}
