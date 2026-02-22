import type { NonDefaultLocale } from '@/i18n/locales'
import { createHash } from 'node:crypto'
import { and, asc, eq, inArray, like, lte, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { loadAutomaticTranslationsEnabled, loadEnabledLocales } from '@/i18n/locale-settings'
import { LOCALE_LABELS, NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion } from '@/lib/ai/openrouter'
import { isCronAuthorized } from '@/lib/auth-cron'
import {
  events as eventsTable,
  event_translations as eventTranslationsTable,
  jobs as jobsTable,
  tags as tagsTable,
  tag_translations as tagTranslationsTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export const maxDuration = 300

const SYNC_TIME_LIMIT_MS = 250_000
const JOB_BATCH_SIZE = 20
const DISCOVERY_SCAN_PAGE_SIZE = 200
const DISCOVERY_ENQUEUE_TARGET = 200
const JOB_UPSERT_BATCH_SIZE = 200
const DEFAULT_MAX_ATTEMPTS = 5
const EVENT_TITLE_TRANSLATION_JOB_TYPE = 'translate_event_title'
const TAG_NAME_TRANSLATION_JOB_TYPE = 'translate_tag_name'
const TRANSLATION_JOB_TYPES = [EVENT_TITLE_TRANSLATION_JOB_TYPE, TAG_NAME_TRANSLATION_JOB_TYPE] as const

type TranslationJobType = (typeof TRANSLATION_JOB_TYPES)[number]

interface EventTranslationJobPayload {
  event_id: string
  locale: NonDefaultLocale
  source_title?: string
  source_hash?: string
}

interface TagTranslationJobPayload {
  tag_id: number
  locale: NonDefaultLocale
  source_name?: string
  source_hash?: string
}

interface TranslationJobRow {
  id: string
  job_type: string
  dedupe_key: string
  payload: unknown
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  available_at: string | Date
}

interface JobIdentity {
  targetId: string
  locale: string
}

interface JobUpsertRow {
  job_type: TranslationJobType
  dedupe_key: string
  payload: EventTranslationJobPayload | TagTranslationJobPayload
  status: 'pending'
  attempts: number
  max_attempts: number
  available_at: string
  reserved_at: null
  last_error: null
}

interface ExistingDiscoveryJobRow {
  job_type: string
  dedupe_key: string
  status: TranslationJobRow['status']
  payload: unknown
}

interface EventSourceRow {
  id: string
  title: string
}

interface TagSourceRow {
  id: number
  name: string
}

interface EventTranslationMetaRow {
  event_id: string
  locale: string
  source_hash: string | null
  is_manual: boolean | null
}

interface TagTranslationMetaRow {
  tag_id: number
  locale: string
  source_hash: string | null
  is_manual: boolean | null
}

interface TranslationJobStats {
  scanned: number
  completed: number
  retried: number
  failed: number
  skippedManual: number
  skippedUpToDate: number
  enqueuedEventJobs: number
  enqueuedTagJobs: number
  timeLimitReached: boolean
  errors: { jobType: string, targetId: string, locale: string, error: string }[]
}

type TranslationSourceLabel = 'event title' | 'tag name'

interface TranslationBatchInputRow {
  id: string
  sourceText: string
  locale: NonDefaultLocale
  sourceLabel: TranslationSourceLabel
}

interface PendingEventTranslationJob {
  kind: typeof EVENT_TITLE_TRANSLATION_JOB_TYPE
  claimed: TranslationJobRow
  identity: JobIdentity
  eventId: string
  locale: NonDefaultLocale
  sourceHash: string
  sourceText: string
  nextPayload: EventTranslationJobPayload
}

interface PendingTagTranslationJob {
  kind: typeof TAG_NAME_TRANSLATION_JOB_TYPE
  claimed: TranslationJobRow
  identity: JobIdentity
  tagId: number
  locale: NonDefaultLocale
  sourceHash: string
  sourceText: string
  nextPayload: TagTranslationJobPayload
}

type PendingTranslationJob = PendingEventTranslationJob | PendingTagTranslationJob

interface ClaimedEventTranslationJob {
  kind: typeof EVENT_TITLE_TRANSLATION_JOB_TYPE
  claimed: TranslationJobRow
  identity: JobIdentity
  payload: EventTranslationJobPayload
}

interface ClaimedTagTranslationJob {
  kind: typeof TAG_NAME_TRANSLATION_JOB_TYPE
  claimed: TranslationJobRow
  identity: JobIdentity
  payload: TagTranslationJobPayload
}

type ClaimedTranslationJob = ClaimedEventTranslationJob | ClaimedTagTranslationJob

function buildSourceHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function buildBackoffMs(attempts: number) {
  const seconds = Math.min(60 * 60, 2 ** Math.max(1, attempts))
  return seconds * 1000
}

function normalizeTranslatedText(value: string) {
  return value
    .trim()
    .replace(/^['"`“”‘’\s]+/, '')
    .replace(/['"`“”‘’\s]+$/, '')
    .trim()
}

function isNonDefaultLocale(value: string): value is NonDefaultLocale {
  return NON_DEFAULT_LOCALES.includes(value as NonDefaultLocale)
}

function isTranslationJobType(value: string): value is TranslationJobType {
  return TRANSLATION_JOB_TYPES.includes(value as TranslationJobType)
}

function normalizeMaxAttempts(value: number | null | undefined) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  return DEFAULT_MAX_ATTEMPTS
}

function parseEventJobPayload(payload: unknown, dedupeKey: string): EventTranslationJobPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid payload for job ${dedupeKey}: expected object`)
  }

  const value = payload as Record<string, unknown>
  const eventId = typeof value.event_id === 'string' ? value.event_id : ''
  const locale = typeof value.locale === 'string' ? value.locale : ''

  if (!eventId) {
    throw new Error(`Invalid payload for job ${dedupeKey}: missing event_id`)
  }

  if (!isNonDefaultLocale(locale)) {
    throw new Error(`Invalid payload for job ${dedupeKey}: locale must be a non-default locale`)
  }

  return {
    event_id: eventId,
    locale,
    source_title: typeof value.source_title === 'string' ? value.source_title : undefined,
    source_hash: typeof value.source_hash === 'string' ? value.source_hash : undefined,
  }
}

function parseTagJobPayload(payload: unknown, dedupeKey: string): TagTranslationJobPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid payload for job ${dedupeKey}: expected object`)
  }

  const value = payload as Record<string, unknown>
  const rawTagId = value.tag_id
  const locale = typeof value.locale === 'string' ? value.locale : ''
  const parsedTagId = typeof rawTagId === 'number'
    ? rawTagId
    : typeof rawTagId === 'string'
      ? Number.parseInt(rawTagId, 10)
      : Number.NaN

  if (!Number.isInteger(parsedTagId) || parsedTagId <= 0) {
    throw new Error(`Invalid payload for job ${dedupeKey}: missing or invalid tag_id`)
  }

  if (!isNonDefaultLocale(locale)) {
    throw new Error(`Invalid payload for job ${dedupeKey}: locale must be a non-default locale`)
  }

  return {
    tag_id: parsedTagId,
    locale,
    source_name: typeof value.source_name === 'string' ? value.source_name : undefined,
    source_hash: typeof value.source_hash === 'string' ? value.source_hash : undefined,
  }
}

function splitDedupeKey(dedupeKey: string): JobIdentity {
  const [targetId = 'unknown', locale = 'unknown'] = dedupeKey.split(':')
  return { targetId, locale }
}

function getJobIdentity(job: Pick<TranslationJobRow, 'job_type' | 'payload' | 'dedupe_key'>): JobIdentity {
  try {
    if (job.job_type === EVENT_TITLE_TRANSLATION_JOB_TYPE) {
      const payload = parseEventJobPayload(job.payload, job.dedupe_key)
      return {
        targetId: payload.event_id,
        locale: payload.locale,
      }
    }

    if (job.job_type === TAG_NAME_TRANSLATION_JOB_TYPE) {
      const payload = parseTagJobPayload(job.payload, job.dedupe_key)
      return {
        targetId: String(payload.tag_id),
        locale: payload.locale,
      }
    }
  }
  catch {
    // Fall through to dedupe key parsing
  }

  return splitDedupeKey(job.dedupe_key)
}

function isTimeLimitReached(startedAtMs: number) {
  return Date.now() - startedAtMs >= SYNC_TIME_LIMIT_MS
}

function buildJobConflictKey(jobType: string, dedupeKey: string) {
  return `${jobType}:${dedupeKey}`
}

function getSourceHashFromUpsertPayload(payload: JobUpsertRow['payload']) {
  return typeof payload.source_hash === 'string' ? payload.source_hash : null
}

function getSourceHashFromStoredJobPayload(job: Pick<TranslationJobRow, 'job_type' | 'payload' | 'dedupe_key'>) {
  try {
    if (job.job_type === EVENT_TITLE_TRANSLATION_JOB_TYPE) {
      const parsed = parseEventJobPayload(job.payload, job.dedupe_key)
      return parsed.source_hash ?? null
    }

    if (job.job_type === TAG_NAME_TRANSLATION_JOB_TYPE) {
      const parsed = parseTagJobPayload(job.payload, job.dedupe_key)
      return parsed.source_hash ?? null
    }
  }
  catch {
    // Treat malformed payload as unknown hash.
  }

  return null
}

function shouldUpsertDiscoveryRow(existing: ExistingDiscoveryJobRow | undefined, next: JobUpsertRow) {
  if (!existing) {
    return true
  }

  if (existing.status === 'pending' || existing.status === 'processing') {
    return false
  }

  if (existing.status === 'completed') {
    return true
  }

  if (existing.status === 'failed') {
    const existingSourceHash = getSourceHashFromStoredJobPayload(existing)
    const nextSourceHash = getSourceHashFromUpsertPayload(next.payload)

    if (!existingSourceHash || !nextSourceHash) {
      return true
    }

    return existingSourceHash !== nextSourceHash
  }

  return true
}

async function upsertJobs(rows: JobUpsertRow[]) {
  let persistedRows = 0

  for (let index = 0; index < rows.length; index += JOB_UPSERT_BATCH_SIZE) {
    const chunk = rows.slice(index, index + JOB_UPSERT_BATCH_SIZE)
    const dedupeKeys = [...new Set(chunk.map(row => row.dedupe_key))]

    const existingRows = await db
      .select({
        job_type: jobsTable.job_type,
        dedupe_key: jobsTable.dedupe_key,
        status: jobsTable.status,
        payload: jobsTable.payload,
      })
      .from(jobsTable)
      .where(and(
        inArray(jobsTable.job_type, [...TRANSLATION_JOB_TYPES]),
        inArray(jobsTable.dedupe_key, dedupeKeys),
      ))

    const existingMap = new Map<string, ExistingDiscoveryJobRow>()
    for (const existing of existingRows as ExistingDiscoveryJobRow[]) {
      existingMap.set(buildJobConflictKey(existing.job_type, existing.dedupe_key), existing)
    }

    const rowsToUpsert = chunk.filter((row) => {
      const key = buildJobConflictKey(row.job_type, row.dedupe_key)
      return shouldUpsertDiscoveryRow(existingMap.get(key), row)
    })

    if (rowsToUpsert.length === 0) {
      continue
    }

    await db
      .insert(jobsTable)
      .values(rowsToUpsert.map(row => ({
        ...row,
        available_at: new Date(row.available_at),
      })))
      .onConflictDoUpdate({
        target: [jobsTable.job_type, jobsTable.dedupe_key],
        set: {
          payload: sql`excluded.payload`,
          status: sql`excluded.status`,
          attempts: sql`excluded.attempts`,
          max_attempts: sql`excluded.max_attempts`,
          available_at: sql`excluded.available_at`,
          reserved_at: sql`excluded.reserved_at`,
          last_error: sql`excluded.last_error`,
        },
      })

    persistedRows += rowsToUpsert.length
  }

  return persistedRows
}

function buildEventTranslationMetaMap(rows: EventTranslationMetaRow[]) {
  const map = new Map<string, { source_hash: string | null, is_manual: boolean }>()

  for (const row of rows) {
    if (!isNonDefaultLocale(row.locale)) {
      continue
    }

    map.set(`${row.event_id}:${row.locale}`, {
      source_hash: typeof row.source_hash === 'string' ? row.source_hash : null,
      is_manual: Boolean(row.is_manual),
    })
  }

  return map
}

function buildTagTranslationMetaMap(rows: TagTranslationMetaRow[]) {
  const map = new Map<string, { source_hash: string | null, is_manual: boolean }>()

  for (const row of rows) {
    if (!isNonDefaultLocale(row.locale)) {
      continue
    }

    map.set(`${row.tag_id}:${row.locale}`, {
      source_hash: typeof row.source_hash === 'string' ? row.source_hash : null,
      is_manual: Boolean(row.is_manual),
    })
  }

  return map
}

async function enqueueEventDiscoveryJobs(
  startedAtMs: number,
  maxJobs: number,
  locales: NonDefaultLocale[],
): Promise<number> {
  if (maxJobs <= 0) {
    return 0
  }
  if (locales.length === 0) {
    return 0
  }

  let offset = 0
  let enqueued = 0

  while (enqueued < maxJobs && !isTimeLimitReached(startedAtMs)) {
    const events = await db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
      })
      .from(eventsTable)
      .orderBy(asc(eventsTable.id))
      .offset(offset)
      .limit(DISCOVERY_SCAN_PAGE_SIZE)

    const sourceRows = (events as EventSourceRow[])
      .map(row => ({
        id: row.id,
        title: typeof row.title === 'string' ? row.title.trim() : '',
      }))
      .filter(row => row.title.length > 0)

    if (!events.length) {
      break
    }

    if (sourceRows.length > 0) {
      const eventIds = sourceRows.map(row => row.id)
      const translationRows = await db
        .select({
          event_id: eventTranslationsTable.event_id,
          locale: eventTranslationsTable.locale,
          source_hash: eventTranslationsTable.source_hash,
          is_manual: eventTranslationsTable.is_manual,
        })
        .from(eventTranslationsTable)
        .where(and(
          inArray(eventTranslationsTable.event_id, eventIds),
          inArray(eventTranslationsTable.locale, locales),
        ))

      const metaMap = buildEventTranslationMetaMap(translationRows as EventTranslationMetaRow[])
      const availableAt = new Date().toISOString()
      const rowsToUpsert: JobUpsertRow[] = []
      let reachedJobLimit = false

      for (const sourceRow of sourceRows) {
        if (reachedJobLimit) {
          break
        }

        const sourceHash = buildSourceHash(sourceRow.title)

        for (const locale of locales) {
          if (enqueued + rowsToUpsert.length >= maxJobs) {
            reachedJobLimit = true
            break
          }

          const key = `${sourceRow.id}:${locale}`
          const existing = metaMap.get(key)
          if (existing?.is_manual) {
            continue
          }
          if (existing?.source_hash === sourceHash) {
            continue
          }

          rowsToUpsert.push({
            job_type: EVENT_TITLE_TRANSLATION_JOB_TYPE,
            dedupe_key: key,
            payload: {
              event_id: sourceRow.id,
              locale,
              source_title: sourceRow.title,
              source_hash: sourceHash,
            },
            status: 'pending',
            attempts: 0,
            max_attempts: DEFAULT_MAX_ATTEMPTS,
            available_at: availableAt,
            reserved_at: null,
            last_error: null,
          })
        }
      }

      if (rowsToUpsert.length > 0) {
        enqueued += await upsertJobs(rowsToUpsert)
      }
    }

    if (events.length < DISCOVERY_SCAN_PAGE_SIZE) {
      break
    }

    offset += events.length
  }

  return enqueued
}

async function enqueueTagDiscoveryJobs(
  startedAtMs: number,
  maxJobs: number,
  locales: NonDefaultLocale[],
): Promise<number> {
  if (maxJobs <= 0) {
    return 0
  }
  if (locales.length === 0) {
    return 0
  }

  let offset = 0
  let enqueued = 0

  while (enqueued < maxJobs && !isTimeLimitReached(startedAtMs)) {
    const tags = await db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
      })
      .from(tagsTable)
      .orderBy(asc(tagsTable.id))
      .offset(offset)
      .limit(DISCOVERY_SCAN_PAGE_SIZE)

    const sourceRows = (tags as TagSourceRow[])
      .map(row => ({
        id: row.id,
        name: typeof row.name === 'string' ? row.name.trim() : '',
      }))
      .filter(row => row.name.length > 0)

    if (!tags.length) {
      break
    }

    if (sourceRows.length > 0) {
      const tagIds = sourceRows.map(row => row.id)
      const translationRows = await db
        .select({
          tag_id: tagTranslationsTable.tag_id,
          locale: tagTranslationsTable.locale,
          source_hash: tagTranslationsTable.source_hash,
          is_manual: tagTranslationsTable.is_manual,
        })
        .from(tagTranslationsTable)
        .where(and(
          inArray(tagTranslationsTable.tag_id, tagIds),
          inArray(tagTranslationsTable.locale, locales),
        ))

      const metaMap = buildTagTranslationMetaMap(translationRows as TagTranslationMetaRow[])
      const availableAt = new Date().toISOString()
      const rowsToUpsert: JobUpsertRow[] = []
      let reachedJobLimit = false

      for (const sourceRow of sourceRows) {
        if (reachedJobLimit) {
          break
        }

        const sourceHash = buildSourceHash(sourceRow.name)

        for (const locale of locales) {
          if (enqueued + rowsToUpsert.length >= maxJobs) {
            reachedJobLimit = true
            break
          }

          const key = `${sourceRow.id}:${locale}`
          const existing = metaMap.get(key)
          if (existing?.is_manual) {
            continue
          }
          if (existing?.source_hash === sourceHash) {
            continue
          }

          rowsToUpsert.push({
            job_type: TAG_NAME_TRANSLATION_JOB_TYPE,
            dedupe_key: key,
            payload: {
              tag_id: sourceRow.id,
              locale,
              source_name: sourceRow.name,
              source_hash: sourceHash,
            },
            status: 'pending',
            attempts: 0,
            max_attempts: DEFAULT_MAX_ATTEMPTS,
            available_at: availableAt,
            reserved_at: null,
            last_error: null,
          })
        }
      }

      if (rowsToUpsert.length > 0) {
        enqueued += await upsertJobs(rowsToUpsert)
      }
    }

    if (tags.length < DISCOVERY_SCAN_PAGE_SIZE) {
      break
    }

    offset += tags.length
  }

  return enqueued
}

async function enqueueMissingOrOutdatedTranslationJobs(startedAtMs: number, locales: NonDefaultLocale[]) {
  const perTypeTarget = Math.max(1, Math.floor(DISCOVERY_ENQUEUE_TARGET / 2))
  const enqueuedEventJobs = await enqueueEventDiscoveryJobs(startedAtMs, perTypeTarget, locales)
  const enqueuedTagJobs = await enqueueTagDiscoveryJobs(startedAtMs, perTypeTarget, locales)

  return {
    enqueuedEventJobs,
    enqueuedTagJobs,
  }
}

async function fetchCandidateJobs(nowIso: string, locales: NonDefaultLocale[]): Promise<TranslationJobRow[]> {
  if (locales.length === 0) {
    return []
  }

  const localePredicates = locales.map(locale => like(jobsTable.dedupe_key, `%:${locale}`))
  const localePredicate = localePredicates.length === 1
    ? localePredicates[0]
    : or(...localePredicates)

  const rows = await db
    .select({
      id: jobsTable.id,
      job_type: jobsTable.job_type,
      dedupe_key: jobsTable.dedupe_key,
      payload: jobsTable.payload,
      status: jobsTable.status,
      attempts: jobsTable.attempts,
      max_attempts: jobsTable.max_attempts,
      available_at: jobsTable.available_at,
    })
    .from(jobsTable)
    .where(and(
      inArray(jobsTable.job_type, [...TRANSLATION_JOB_TYPES]),
      eq(jobsTable.status, 'pending'),
      lte(jobsTable.available_at, new Date(nowIso)),
      localePredicate,
    ))
    .orderBy(asc(jobsTable.available_at), asc(jobsTable.updated_at))
    .limit(JOB_BATCH_SIZE)

  return rows as TranslationJobRow[]
}

async function claimJob(job: TranslationJobRow, nowIso: string): Promise<TranslationJobRow | null> {
  if (!isTranslationJobType(job.job_type)) {
    return null
  }

  const claimedRows = await db
    .update(jobsTable)
    .set({
      status: 'processing',
      reserved_at: new Date(nowIso),
      last_error: null,
    })
    .where(and(
      eq(jobsTable.id, job.id),
      eq(jobsTable.job_type, job.job_type),
      eq(jobsTable.status, 'pending'),
      lte(jobsTable.available_at, new Date(nowIso)),
    ))
    .returning({
      id: jobsTable.id,
      job_type: jobsTable.job_type,
      dedupe_key: jobsTable.dedupe_key,
      payload: jobsTable.payload,
      status: jobsTable.status,
      attempts: jobsTable.attempts,
      max_attempts: jobsTable.max_attempts,
      available_at: jobsTable.available_at,
    })

  return (claimedRows[0] as TranslationJobRow | undefined) ?? null
}

async function completeJob(job: TranslationJobRow, payload: EventTranslationJobPayload | TagTranslationJobPayload) {
  await db
    .update(jobsTable)
    .set({
      status: 'completed',
      attempts: (job.attempts ?? 0) + 1,
      available_at: new Date(),
      reserved_at: null,
      last_error: null,
      payload,
    })
    .where(and(
      eq(jobsTable.id, job.id),
      eq(jobsTable.job_type, job.job_type),
    ))
}

async function scheduleRetry(job: TranslationJobRow, rawError: unknown): Promise<{ retryScheduled: boolean }> {
  const attempts = (job.attempts ?? 0) + 1
  const maxAttempts = normalizeMaxAttempts(job.max_attempts)
  const exhausted = attempts >= maxAttempts
  const retryAt = exhausted
    ? new Date()
    : new Date(Date.now() + buildBackoffMs(attempts))
  const message = rawError instanceof Error ? rawError.message : String(rawError)
  const truncatedMessage = message.slice(0, 1000)

  await db
    .update(jobsTable)
    .set({
      status: exhausted ? 'failed' : 'pending',
      attempts,
      available_at: retryAt,
      reserved_at: null,
      last_error: truncatedMessage,
    })
    .where(and(
      eq(jobsTable.id, job.id),
      eq(jobsTable.job_type, job.job_type),
    ))

  return { retryScheduled: !exhausted }
}

async function loadEventSourcesMap(eventIds: string[]) {
  const uniqueIds = [...new Set(eventIds)]
  const map = new Map<string, string>()
  if (uniqueIds.length === 0) {
    return map
  }

  const rows = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
    })
    .from(eventsTable)
    .where(inArray(eventsTable.id, uniqueIds))

  for (const row of rows as EventSourceRow[]) {
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) {
      continue
    }
    map.set(row.id, title)
  }

  return map
}

async function loadTagSourcesMap(tagIds: number[]) {
  const uniqueIds = [...new Set(tagIds)]
  const map = new Map<number, string>()
  if (uniqueIds.length === 0) {
    return map
  }

  const rows = await db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
    })
    .from(tagsTable)
    .where(inArray(tagsTable.id, uniqueIds))

  for (const row of rows as TagSourceRow[]) {
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) {
      continue
    }
    map.set(row.id, name)
  }

  return map
}

async function loadEventTranslationMetaMapForJobs(eventIds: string[], locales: NonDefaultLocale[]) {
  const uniqueEventIds = [...new Set(eventIds)]
  const uniqueLocales = [...new Set(locales)]
  if (uniqueEventIds.length === 0 || uniqueLocales.length === 0) {
    return new Map<string, { source_hash: string | null, is_manual: boolean }>()
  }

  const rows = await db
    .select({
      event_id: eventTranslationsTable.event_id,
      locale: eventTranslationsTable.locale,
      is_manual: eventTranslationsTable.is_manual,
      source_hash: eventTranslationsTable.source_hash,
    })
    .from(eventTranslationsTable)
    .where(and(
      inArray(eventTranslationsTable.event_id, uniqueEventIds),
      inArray(eventTranslationsTable.locale, uniqueLocales),
    ))

  return buildEventTranslationMetaMap(rows as EventTranslationMetaRow[])
}

async function loadTagTranslationMetaMapForJobs(tagIds: number[], locales: NonDefaultLocale[]) {
  const uniqueTagIds = [...new Set(tagIds)]
  const uniqueLocales = [...new Set(locales)]
  if (uniqueTagIds.length === 0 || uniqueLocales.length === 0) {
    return new Map<string, { source_hash: string | null, is_manual: boolean }>()
  }

  const rows = await db
    .select({
      tag_id: tagTranslationsTable.tag_id,
      locale: tagTranslationsTable.locale,
      is_manual: tagTranslationsTable.is_manual,
      source_hash: tagTranslationsTable.source_hash,
    })
    .from(tagTranslationsTable)
    .where(and(
      inArray(tagTranslationsTable.tag_id, uniqueTagIds),
      inArray(tagTranslationsTable.locale, uniqueLocales),
    ))

  return buildTagTranslationMetaMap(rows as TagTranslationMetaRow[])
}

async function upsertAutoEventTranslation(eventId: string, locale: NonDefaultLocale, title: string, sourceHash: string) {
  const payload = {
    event_id: eventId,
    locale,
    title,
    source_hash: sourceHash,
    is_manual: false,
  }

  await db
    .insert(eventTranslationsTable)
    .values(payload)
    .onConflictDoUpdate({
      target: [eventTranslationsTable.event_id, eventTranslationsTable.locale],
      set: payload,
    })
}

async function upsertAutoTagTranslation(tagId: number, locale: NonDefaultLocale, name: string, sourceHash: string) {
  const payload = {
    tag_id: tagId,
    locale,
    name,
    source_hash: sourceHash,
    is_manual: false,
  }

  await db
    .insert(tagTranslationsTable)
    .values(payload)
    .onConflictDoUpdate({
      target: [tagTranslationsTable.tag_id, tagTranslationsTable.locale],
      set: payload,
    })
}
function extractJsonObject(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }

  let withoutFences = trimmed
  if (withoutFences.startsWith('```')) {
    const firstNewline = withoutFences.indexOf('\n')
    if (firstNewline !== -1) {
      withoutFences = withoutFences.slice(firstNewline + 1)
      if (withoutFences.endsWith('```')) {
        withoutFences = withoutFences.slice(0, -3)
      }
      withoutFences = withoutFences.trim()
    }
  }

  const firstBrace = withoutFences.indexOf('{')
  const lastBrace = withoutFences.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return withoutFences
  }

  return withoutFences.slice(firstBrace, lastBrace + 1)
}

function parseBatchTranslationResponse(raw: string) {
  const jsonPayload = extractJsonObject(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonPayload)
  }
  catch {
    throw new Error('Model returned invalid JSON for translation batch.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Model returned an unexpected translation batch payload.')
  }

  const rows = (parsed as { translations?: unknown }).translations
  if (!Array.isArray(rows)) {
    throw new TypeError('Model did not return a translations array.')
  }

  const result = new Map<string, string>()

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const id = typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id : ''
    const translatedText = typeof (row as { text?: unknown }).text === 'string' ? (row as { text: string }).text : ''
    const normalizedText = normalizeTranslatedText(translatedText)

    if (!id || !normalizedText) {
      continue
    }

    result.set(id, normalizedText)
  }

  if (result.size === 0) {
    throw new Error('Model returned no valid translations in the batch payload.')
  }

  return result
}

async function translateBatchText(rows: TranslationBatchInputRow[], model?: string, apiKey?: string) {
  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured.')
  }

  if (rows.length === 0) {
    return new Map<string, string>()
  }

  const payload = rows.map(row => ({
    id: row.id,
    source_label: row.sourceLabel,
    source_text: row.sourceText,
    locale: row.locale,
    locale_label: LOCALE_LABELS[row.locale],
  }))

  const translated = await requestOpenRouterCompletion([
    {
      role: 'system',
      content: [
        'You are a translation engine specialized in short labels and event titles.',
        'Translate every item independently based on its locale.',
        'Return only valid JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        'Translate each item from English to the target locale.',
        'Rules:',
        '- Return only JSON in this exact shape: {"translations":[{"id":"...","text":"..."}]}.',
        '- Include each input id exactly once in the output.',
        '- Keep translation concise and neutral.',
        '- Preserve names, acronyms, tickers, numbers, and dates exactly when appropriate.',
        '- Do not add notes, explanations, markdown, or extra keys.',
        `Input JSON: ${JSON.stringify(payload)}`,
      ].join('\n'),
    },
  ], {
    apiKey,
    model,
    temperature: 0,
    maxTokens: Math.min(4_000, Math.max(250, rows.length * 120)),
  })

  return parseBatchTranslationResponse(translated)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function pushJobError(stats: TranslationJobStats, jobType: string, identity: JobIdentity, error: unknown) {
  stats.errors.push({
    jobType,
    targetId: identity.targetId,
    locale: identity.locale,
    error: getErrorMessage(error),
  })
}

async function retryClaimedJob(claimed: TranslationJobRow, identity: JobIdentity, error: unknown, stats: TranslationJobStats) {
  pushJobError(stats, claimed.job_type, identity, error)

  try {
    const { retryScheduled } = await scheduleRetry(claimed, error)
    if (retryScheduled) {
      stats.retried += 1
    }
    else {
      stats.failed += 1
    }
  }
  catch (rescheduleError) {
    stats.failed += 1
    pushJobError(stats, claimed.job_type, identity, rescheduleError)
  }
}

async function processPendingTranslationJobs(
  pendingJobs: PendingTranslationJob[],
  model: string | undefined,
  apiKey: string | undefined,
  stats: TranslationJobStats,
) {
  if (pendingJobs.length === 0) {
    return
  }

  const batchRows: TranslationBatchInputRow[] = pendingJobs.map(job => ({
    id: job.claimed.id,
    sourceText: job.sourceText,
    locale: job.locale,
    sourceLabel: job.kind === EVENT_TITLE_TRANSLATION_JOB_TYPE ? 'event title' : 'tag name',
  }))

  let translatedById: Map<string, string>

  try {
    translatedById = await translateBatchText(batchRows, model, apiKey)
  }
  catch (error) {
    for (const pendingJob of pendingJobs) {
      await retryClaimedJob(pendingJob.claimed, pendingJob.identity, error, stats)
    }
    return
  }

  for (const pendingJob of pendingJobs) {
    const translatedText = translatedById.get(pendingJob.claimed.id)
    if (!translatedText) {
      await retryClaimedJob(
        pendingJob.claimed,
        pendingJob.identity,
        new Error(`Missing translated text for job ${pendingJob.claimed.id} in batch response.`),
        stats,
      )
      continue
    }

    try {
      if (pendingJob.kind === EVENT_TITLE_TRANSLATION_JOB_TYPE) {
        await upsertAutoEventTranslation(pendingJob.eventId, pendingJob.locale, translatedText, pendingJob.sourceHash)
        await completeJob(pendingJob.claimed, pendingJob.nextPayload)
        stats.completed += 1
        continue
      }

      await upsertAutoTagTranslation(pendingJob.tagId, pendingJob.locale, translatedText, pendingJob.sourceHash)
      await completeJob(pendingJob.claimed, pendingJob.nextPayload)
      stats.completed += 1
    }
    catch (error) {
      await retryClaimedJob(pendingJob.claimed, pendingJob.identity, error, stats)
    }
  }
}

async function preparePendingTranslationJobs(
  claimedJobs: ClaimedTranslationJob[],
  stats: TranslationJobStats,
) {
  const pendingJobs: PendingTranslationJob[] = []
  if (claimedJobs.length === 0) {
    return pendingJobs
  }

  const eventJobs = claimedJobs.filter(job => job.kind === EVENT_TITLE_TRANSLATION_JOB_TYPE)
  const tagJobs = claimedJobs.filter(job => job.kind === TAG_NAME_TRANSLATION_JOB_TYPE)

  const [eventSourceMap, tagSourceMap, eventMetaMap, tagMetaMap] = await Promise.all([
    loadEventSourcesMap(eventJobs.map(job => job.payload.event_id)),
    loadTagSourcesMap(tagJobs.map(job => job.payload.tag_id)),
    loadEventTranslationMetaMapForJobs(
      eventJobs.map(job => job.payload.event_id),
      eventJobs.map(job => job.payload.locale),
    ),
    loadTagTranslationMetaMapForJobs(
      tagJobs.map(job => job.payload.tag_id),
      tagJobs.map(job => job.payload.locale),
    ),
  ])

  for (const claimedJob of claimedJobs) {
    try {
      if (claimedJob.kind === EVENT_TITLE_TRANSLATION_JOB_TYPE) {
        const sourceTitle = eventSourceMap.get(claimedJob.payload.event_id)
        if (!sourceTitle) {
          throw new Error(`Event ${claimedJob.payload.event_id} does not have a valid source title`)
        }

        const sourceHash = buildSourceHash(sourceTitle)
        const nextPayload: EventTranslationJobPayload = {
          event_id: claimedJob.payload.event_id,
          locale: claimedJob.payload.locale,
          source_title: sourceTitle,
          source_hash: sourceHash,
        }
        const currentTranslation = eventMetaMap.get(`${claimedJob.payload.event_id}:${claimedJob.payload.locale}`)
        if (currentTranslation?.is_manual) {
          await completeJob(claimedJob.claimed, nextPayload)
          stats.skippedManual += 1
          continue
        }
        if (currentTranslation?.source_hash === sourceHash) {
          await completeJob(claimedJob.claimed, nextPayload)
          stats.skippedUpToDate += 1
          continue
        }

        pendingJobs.push({
          kind: EVENT_TITLE_TRANSLATION_JOB_TYPE,
          claimed: claimedJob.claimed,
          identity: claimedJob.identity,
          eventId: claimedJob.payload.event_id,
          locale: claimedJob.payload.locale,
          sourceHash,
          sourceText: sourceTitle,
          nextPayload,
        })
        continue
      }

      const sourceName = tagSourceMap.get(claimedJob.payload.tag_id)
      if (!sourceName) {
        throw new Error(`Tag ${claimedJob.payload.tag_id} does not have a valid source name`)
      }

      const sourceHash = buildSourceHash(sourceName)
      const nextPayload: TagTranslationJobPayload = {
        tag_id: claimedJob.payload.tag_id,
        locale: claimedJob.payload.locale,
        source_name: sourceName,
        source_hash: sourceHash,
      }
      const currentTranslation = tagMetaMap.get(`${claimedJob.payload.tag_id}:${claimedJob.payload.locale}`)
      if (currentTranslation?.is_manual) {
        await completeJob(claimedJob.claimed, nextPayload)
        stats.skippedManual += 1
        continue
      }
      if (currentTranslation?.source_hash === sourceHash) {
        await completeJob(claimedJob.claimed, nextPayload)
        stats.skippedUpToDate += 1
        continue
      }

      pendingJobs.push({
        kind: TAG_NAME_TRANSLATION_JOB_TYPE,
        claimed: claimedJob.claimed,
        identity: claimedJob.identity,
        tagId: claimedJob.payload.tag_id,
        locale: claimedJob.payload.locale,
        sourceHash,
        sourceText: sourceName,
        nextPayload,
      })
    }
    catch (error) {
      await retryClaimedJob(claimedJob.claimed, claimedJob.identity, error, stats)
    }
  }

  return pendingJobs
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const stats: TranslationJobStats = {
    scanned: 0,
    completed: 0,
    retried: 0,
    failed: 0,
    skippedManual: 0,
    skippedUpToDate: 0,
    enqueuedEventJobs: 0,
    enqueuedTagJobs: 0,
    timeLimitReached: false,
    errors: [],
  }

  try {
    const [openRouterSettings, automaticTranslationsEnabled, enabledLocales] = await Promise.all([
      loadOpenRouterProviderSettings(),
      loadAutomaticTranslationsEnabled(),
      loadEnabledLocales(),
    ])
    const enabledTranslationLocales = enabledLocales.filter(isNonDefaultLocale)

    if (!openRouterSettings.configured || !openRouterSettings.apiKey) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'OpenRouter is not configured.',
        ...stats,
      })
    }

    if (!automaticTranslationsEnabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Automatic translations are disabled in Locale Settings.',
        ...stats,
      })
    }

    if (enabledTranslationLocales.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No non-default locales are enabled in Locale Settings.',
        ...stats,
      })
    }

    const startedAt = Date.now()

    while (Date.now() - startedAt < SYNC_TIME_LIMIT_MS) {
      const nowIso = new Date().toISOString()
      const candidates = await fetchCandidateJobs(nowIso, enabledTranslationLocales)

      if (!candidates.length) {
        const discovery = await enqueueMissingOrOutdatedTranslationJobs(startedAt, enabledTranslationLocales)
        stats.enqueuedEventJobs += discovery.enqueuedEventJobs
        stats.enqueuedTagJobs += discovery.enqueuedTagJobs

        if ((discovery.enqueuedEventJobs + discovery.enqueuedTagJobs) === 0) {
          break
        }

        continue
      }

      const claimedJobs: ClaimedTranslationJob[] = []

      for (const candidate of candidates) {
        if (Date.now() - startedAt >= SYNC_TIME_LIMIT_MS) {
          stats.timeLimitReached = true
          break
        }

        stats.scanned += 1

        let claimed: TranslationJobRow | null = null
        let claimedIdentity: JobIdentity | null = null
        const candidateIdentity = getJobIdentity(candidate)

        try {
          claimed = await claimJob(candidate, nowIso)
          if (!claimed) {
            continue
          }

          if (claimed.job_type === EVENT_TITLE_TRANSLATION_JOB_TYPE) {
            const payload = parseEventJobPayload(claimed.payload, claimed.dedupe_key)
            const identity = {
              targetId: payload.event_id,
              locale: payload.locale,
            }
            claimedIdentity = identity

            claimedJobs.push({
              kind: EVENT_TITLE_TRANSLATION_JOB_TYPE,
              claimed,
              identity,
              payload,
            })
            continue
          }

          if (claimed.job_type === TAG_NAME_TRANSLATION_JOB_TYPE) {
            const payload = parseTagJobPayload(claimed.payload, claimed.dedupe_key)
            const identity = {
              targetId: String(payload.tag_id),
              locale: payload.locale,
            }
            claimedIdentity = identity

            claimedJobs.push({
              kind: TAG_NAME_TRANSLATION_JOB_TYPE,
              claimed,
              identity,
              payload,
            })
            continue
          }

          throw new Error(`Unsupported translation job type: ${claimed.job_type}`)
        }
        catch (error) {
          const identity = claimedIdentity ?? (claimed ? getJobIdentity(claimed) : candidateIdentity)

          if (!claimed) {
            pushJobError(stats, candidate.job_type, identity, error)
            stats.failed += 1
            continue
          }

          await retryClaimedJob(claimed, identity, error, stats)
        }
      }

      try {
        const pendingTranslations = await preparePendingTranslationJobs(claimedJobs, stats)
        await processPendingTranslationJobs(
          pendingTranslations,
          openRouterSettings.model,
          openRouterSettings.apiKey,
          stats,
        )
      }
      catch (error) {
        for (const claimedJob of claimedJobs) {
          await retryClaimedJob(claimedJob.claimed, claimedJob.identity, error, stats)
        }
      }

      if (stats.timeLimitReached) {
        break
      }
    }

    if (isTimeLimitReached(startedAt)) {
      stats.timeLimitReached = true
    }

    return NextResponse.json({
      success: true,
      ...stats,
    })
  }
  catch (error) {
    console.error('translation-sync failed', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...stats,
    }, { status: 500 })
  }
}
