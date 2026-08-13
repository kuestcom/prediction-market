export function toDomainTimestamp(value: Date | number | undefined) {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : Number.NaN
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN
  }

  return Number.NaN
}

export function normalizeTicks(sourceTicks: number[]) {
  const seen = new Set<number>()

  return sourceTicks.filter((value) => {
    if (!Number.isFinite(value) || seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}
