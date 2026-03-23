import { formatDateTimeLocalValue, normalizeDateTimeLocalValue } from '@/lib/datetime-local'

export type EventCreationMode = 'single' | 'recurring'
export type EventCreationStatus = 'draft' | 'scheduled' | 'running' | 'deployed' | 'failed' | 'canceled'
export type EventCreationRecurrenceUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'semiannual' | 'year'

export interface EventCreationAssetRef {
  storagePath: string
  publicUrl: string
  fileName: string
  contentType: string
}

export interface EventCreationAssetPayload {
  eventImage: EventCreationAssetRef | null
  optionImages: Record<string, EventCreationAssetRef>
  teamLogos: Partial<Record<'home' | 'away', EventCreationAssetRef>>
}

export interface EventCreationOccurrence {
  id: string
  title: string
  startAt: string
  status: EventCreationStatus
  creationMode: EventCreationMode
  isRecurringInstance: boolean
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const BLOCKED_ASSET_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function toLocalDate(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = typeof value === 'string'
    ? new Date(value)
    : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function buildDefaultDeployAt(startAt: Date | null) {
  if (!startAt) {
    return null
  }

  return new Date(startAt.getTime() - (24 * 60 * 60 * 1000))
}

export function addRecurrenceInterval(date: Date, unit: EventCreationRecurrenceUnit, interval: number) {
  const next = new Date(date)
  const safeInterval = Math.max(1, Math.floor(interval || 1))

  if (unit === 'minute') {
    next.setMinutes(next.getMinutes() + safeInterval)
    return next
  }

  if (unit === 'hour') {
    next.setHours(next.getHours() + safeInterval)
    return next
  }

  if (unit === 'day') {
    next.setDate(next.getDate() + safeInterval)
    return next
  }

  if (unit === 'week') {
    next.setDate(next.getDate() + (safeInterval * 7))
    return next
  }

  if (unit === 'month') {
    next.setMonth(next.getMonth() + safeInterval)
    return next
  }

  if (unit === 'quarter') {
    next.setMonth(next.getMonth() + (safeInterval * 3))
    return next
  }

  if (unit === 'semiannual') {
    next.setMonth(next.getMonth() + (safeInterval * 6))
    return next
  }

  next.setFullYear(next.getFullYear() + safeInterval)
  return next
}

export function applyEventCreationTemplate(template: string, date: Date, fallbackValue?: string) {
  const normalizedTemplate = template.trim() || fallbackValue?.trim() || ''
  if (!normalizedTemplate) {
    return ''
  }

  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  const tokens: Record<string, string> = {
    date: `${pad(day)} ${MONTH_NAMES[month - 1]}`,
    date_short: `${pad(day)}/${pad(month)}/${year}`,
    day: String(day),
    day_padded: pad(day),
    month: String(month),
    month_padded: pad(month),
    month_name: MONTH_NAMES[month - 1],
    month_name_lower: MONTH_NAMES[month - 1].toLowerCase(),
    year: String(year),
  }

  return normalizedTemplate.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, token) => tokens[token] ?? '')
}

export function buildOccurrenceTitle(input: {
  title: string
  titleTemplate?: string | null
  slug?: string | null
  slugTemplate?: string | null
  date: Date
}) {
  const title = applyEventCreationTemplate(input.titleTemplate ?? '', input.date, input.title)
  const rawSlug = applyEventCreationTemplate(input.slugTemplate ?? '', input.date, input.slug ?? '')
  const slug = slugify(rawSlug)

  return {
    title,
    slug: slug || slugify(input.slug ?? ''),
  }
}

export function expandEventCreationOccurrences(input: {
  id: string
  title: string
  slug?: string | null
  titleTemplate?: string | null
  slugTemplate?: string | null
  startAt: string | null
  status: EventCreationStatus
  creationMode: EventCreationMode
  recurrenceUnit?: EventCreationRecurrenceUnit | null
  recurrenceInterval?: number | null
  recurrenceUntil?: string | null
  maxOccurrences?: number
}) {
  const startDate = toLocalDate(input.startAt)
  if (!startDate) {
    return [] satisfies EventCreationOccurrence[]
  }

  const maxOccurrences = Math.max(1, Math.min(input.maxOccurrences ?? 12, 48))
  const firstTitle = buildOccurrenceTitle({
    title: input.title,
    titleTemplate: input.titleTemplate,
    slug: input.slug,
    slugTemplate: input.slugTemplate,
    date: startDate,
  })

  const occurrences: EventCreationOccurrence[] = [{
    id: input.id,
    title: firstTitle.title,
    startAt: startDate.toISOString(),
    status: input.status,
    creationMode: input.creationMode,
    isRecurringInstance: false,
  }]

  if (
    input.creationMode !== 'recurring'
    || !input.recurrenceUnit
    || !input.recurrenceInterval
  ) {
    return occurrences
  }

  const recurrenceUntil = toLocalDate(input.recurrenceUntil)
  let cursor = startDate

  for (let index = 1; index < maxOccurrences; index += 1) {
    cursor = addRecurrenceInterval(cursor, input.recurrenceUnit, input.recurrenceInterval)
    if (recurrenceUntil && cursor.getTime() > recurrenceUntil.getTime()) {
      break
    }

    const projected = buildOccurrenceTitle({
      title: input.title,
      titleTemplate: input.titleTemplate,
      slug: input.slug,
      slugTemplate: input.slugTemplate,
      date: cursor,
    })

    occurrences.push({
      id: `${input.id}:${index + 1}`,
      title: projected.title,
      startAt: cursor.toISOString(),
      status: input.status,
      creationMode: input.creationMode,
      isRecurringInstance: true,
    })
  }

  return occurrences
}

export function normalizeEventCreationAssetPayload(payload: unknown): EventCreationAssetPayload {
  const candidate = payload && typeof payload === 'object' ? payload as Partial<EventCreationAssetPayload> : {}
  const eventImage = candidate.eventImage && typeof candidate.eventImage === 'object'
    ? normalizeAssetRef(candidate.eventImage)
    : null

  const optionImages = normalizeAssetRecord(candidate.optionImages)
  const teamLogoInput = candidate.teamLogos && typeof candidate.teamLogos === 'object'
    ? candidate.teamLogos as Partial<Record<'home' | 'away', unknown>>
    : {}

  return {
    eventImage,
    optionImages,
    teamLogos: {
      ...(teamLogoInput.home ? { home: normalizeAssetRef(teamLogoInput.home) } : {}),
      ...(teamLogoInput.away ? { away: normalizeAssetRef(teamLogoInput.away) } : {}),
    },
  }
}

export function isSafeEventCreationAssetRecordKey(key: string) {
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    return false
  }

  return !BLOCKED_ASSET_RECORD_KEYS.has(trimmedKey.toLowerCase())
}

function normalizeAssetRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const normalized: Record<string, EventCreationAssetRef> = {}
  for (const [key, entry] of Object.entries(value)) {
    const trimmedKey = key.trim()
    if (!isSafeEventCreationAssetRecordKey(trimmedKey) || !entry || typeof entry !== 'object') {
      continue
    }
    normalized[trimmedKey] = normalizeAssetRef(entry)
  }
  return normalized
}

function normalizeAssetRef(value: unknown): EventCreationAssetRef {
  const candidate = value && typeof value === 'object'
    ? value as Partial<EventCreationAssetRef>
    : {}

  return {
    storagePath: typeof candidate.storagePath === 'string' ? candidate.storagePath : '',
    publicUrl: typeof candidate.publicUrl === 'string' ? candidate.publicUrl : '',
    fileName: typeof candidate.fileName === 'string' ? candidate.fileName : 'asset',
    contentType: typeof candidate.contentType === 'string' ? candidate.contentType : 'application/octet-stream',
  }
}

export function normalizeScheduleInput(value: string | null | undefined) {
  const normalized = normalizeDateTimeLocalValue(value ?? '')
  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return {
    localValue: formatDateTimeLocalValue(parsed),
    isoValue: parsed.toISOString(),
    date: parsed,
  }
}
