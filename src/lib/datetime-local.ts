const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME_LOCAL_MINUTES_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const DATE_TIME_LOCAL_WITH_SECONDS_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/
const SLASH_DATE_TIME_PATTERN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\sT]+(\d{1,2}):(\d{2}))?$/

function padSegment(value: number) {
  return value.toString().padStart(2, '0')
}

export function formatDateTimeLocalValue(date: Date) {
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = padSegment(date.getMonth() + 1)
  const day = padSegment(date.getDate())
  const hours = padSegment(date.getHours())
  const minutes = padSegment(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function normalizeDateTimeLocalValue(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  if (DATE_TIME_LOCAL_MINUTES_PATTERN.test(normalized)) {
    return normalized
  }

  if (DATE_ONLY_PATTERN.test(normalized)) {
    return `${normalized}T00:00`
  }

  const localMatch = normalized.match(DATE_TIME_LOCAL_WITH_SECONDS_PATTERN)
  if (localMatch) {
    return `${localMatch[1]}T${localMatch[2]}`
  }

  const slashMatch = normalized.match(SLASH_DATE_TIME_PATTERN)
  if (slashMatch) {
    const first = Number.parseInt(slashMatch[1], 10)
    const second = Number.parseInt(slashMatch[2], 10)
    const year = Number.parseInt(slashMatch[3], 10)
    const hours = Number.parseInt(slashMatch[4] ?? '0', 10)
    const minutes = Number.parseInt(slashMatch[5] ?? '0', 10)

    let month = first
    let day = second
    if (first > 12 && second <= 12) {
      day = first
      month = second
    }
    else if (second > 12 && first <= 12) {
      month = first
      day = second
    }
    else if (first > 12 || second > 12) {
      return ''
    }

    if (
      !Number.isFinite(year)
      || !Number.isFinite(month)
      || !Number.isFinite(day)
      || month < 1
      || month > 12
      || day < 1
      || day > 31
      || hours < 0
      || hours > 23
      || minutes < 0
      || minutes > 59
    ) {
      return ''
    }

    return `${year.toString().padStart(4, '0')}-${padSegment(month)}-${padSegment(day)}T${padSegment(hours)}:${padSegment(minutes)}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return formatDateTimeLocalValue(parsed)
}
