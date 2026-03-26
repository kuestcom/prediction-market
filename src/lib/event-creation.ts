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
const EVENT_CREATION_TEMPLATE_TOKEN_REPLACE_PATTERN = /\{\{\s*([a-z_]+(?:[+-]\d+)?)\s*\}\}/gi
const EVENT_CREATION_DATE_TEMPLATE_TOKEN_PATTERN = /\{\{\s*(?:day|day_padded|month|month_padded|month_name|month_name_lower|date|date_short|year)(?:[+-]\d+)?\s*\}\}/i

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildEventCreationWalletTail(walletAddress: string | null | undefined) {
  const normalized = walletAddress?.trim() || ''
  if (!normalized) {
    return ''
  }

  return normalized.replace(/^0x/i, '').slice(-3).toLowerCase()
}

export function buildEventCreationTimestampSeed(value: Date | string | null | undefined) {
  if (!value) {
    return ''
  }

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return Math.floor(parsed.getTime() / 1000).toString()
}

export function appendEventCreationSlugSuffix(base: string, suffix: string) {
  const trimmedBase = base.trim().replace(/-+$/g, '')
  const trimmedSuffix = suffix.trim().replace(/^-+/g, '')
  if (!trimmedBase) {
    return ''
  }
  if (!trimmedSuffix) {
    return trimmedBase
  }
  if (trimmedBase.endsWith(`-${trimmedSuffix}`) || trimmedBase.endsWith(trimmedSuffix)) {
    return trimmedBase
  }
  return `${trimmedBase}-${trimmedSuffix}`
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

export function buildImmediateDeployAt(referenceTimeMs: number | null | undefined) {
  if (typeof referenceTimeMs !== 'number' || !Number.isFinite(referenceTimeMs) || referenceTimeMs <= 0) {
    return null
  }

  return new Date(referenceTimeMs)
}

function shiftRecurrenceInterval(date: Date, unit: EventCreationRecurrenceUnit, intervalDelta: number) {
  const next = new Date(date)
  const safeDelta = Math.trunc(intervalDelta) || 0

  if (unit === 'minute') {
    next.setMinutes(next.getMinutes() + safeDelta)
    return next
  }

  if (unit === 'hour') {
    next.setHours(next.getHours() + safeDelta)
    return next
  }

  if (unit === 'day') {
    next.setDate(next.getDate() + safeDelta)
    return next
  }

  if (unit === 'week') {
    next.setDate(next.getDate() + (safeDelta * 7))
    return next
  }

  if (unit === 'month') {
    next.setMonth(next.getMonth() + safeDelta)
    return next
  }

  if (unit === 'quarter') {
    next.setMonth(next.getMonth() + (safeDelta * 3))
    return next
  }

  if (unit === 'semiannual') {
    next.setMonth(next.getMonth() + (safeDelta * 6))
    return next
  }

  next.setFullYear(next.getFullYear() + safeDelta)
  return next
}

export function addRecurrenceInterval(date: Date, unit: EventCreationRecurrenceUnit, interval: number) {
  const safeInterval = Math.max(1, Math.floor(interval || 1))
  return shiftRecurrenceInterval(date, unit, safeInterval)
}

export function subtractRecurrenceInterval(date: Date, unit: EventCreationRecurrenceUnit, interval: number) {
  const safeInterval = Math.max(1, Math.floor(interval || 1))
  return shiftRecurrenceInterval(date, unit, safeInterval * -1)
}

export function buildScheduledRecurringDeployAt(
  resolutionAt: Date | null,
  unit: EventCreationRecurrenceUnit | null | undefined,
  interval: number | null | undefined,
) {
  if (!resolutionAt || !unit || !interval) {
    return null
  }

  const previousOccurrenceResolutionAt = subtractRecurrenceInterval(resolutionAt, unit, interval)
  return buildDefaultDeployAt(previousOccurrenceResolutionAt)
}

export function hasEventCreationDateTemplateVariable(value: string | null | undefined) {
  const normalized = value?.trim() || ''
  if (!normalized) {
    return false
  }

  return EVENT_CREATION_DATE_TEMPLATE_TOKEN_PATTERN.test(normalized)
}

function buildEventCreationTemplateTokens(date: Date) {
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

  return tokens
}

function resolveEventCreationTemplateToken(rawToken: string, baseDate: Date) {
  const normalizedToken = rawToken.trim().toLowerCase()
  const match = /^([a-z_]+)([+-]\d+)?$/.exec(normalizedToken)
  if (!match) {
    return ''
  }

  const [, baseToken, dayOffsetToken] = match
  const dayOffset = dayOffsetToken ? Number.parseInt(dayOffsetToken, 10) : 0
  const targetDate = new Date(baseDate)
  if (Number.isFinite(dayOffset) && dayOffset !== 0) {
    targetDate.setDate(targetDate.getDate() + dayOffset)
  }

  return buildEventCreationTemplateTokens(targetDate)[baseToken] ?? ''
}

export function applyEventCreationTemplate(template: string, date: Date, fallbackValue?: string) {
  const normalizedTemplate = template.trim() || fallbackValue?.trim() || ''
  if (!normalizedTemplate) {
    return ''
  }

  return normalizedTemplate.replace(EVENT_CREATION_TEMPLATE_TOKEN_REPLACE_PATTERN, (_match, token) => {
    return resolveEventCreationTemplateToken(token, date)
  })
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
