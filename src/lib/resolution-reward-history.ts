export function parseResolutionHistoryCount(value: unknown): number | null {
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value.trim())) {
      return null
    }
  } else if (typeof value !== 'number') {
    return null
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}
