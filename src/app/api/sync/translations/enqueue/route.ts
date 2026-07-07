import type { NonDefaultLocale } from '@/i18n/locales'
import { createHash } from 'node:crypto'
import { and, asc, inArray, sql } from 'drizzle-orm'
import { loadAutomaticTranslationsEnabled, loadEnabledLocales } from '@/i18n/locale-settings'
import { NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import {
  events as eventsTable,
  event_translations as eventTranslationsTable,
  jobs as jobsTable,
  tags as tagsTable,
  tag_translations as tagTranslationsTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { buildCronJsonResponse, handleCronRoute } from '@/lib/sync/cron-route'

export const maxDuration = 30

const ENQUEUE_TIME_LIMIT_MS = 20_000
const DISCOVERY_SCAN_PAGE_SIZE = 100
const DISCOVERY_ENQUEUE_TARGET = 50
const JOB_UPSERT_BATCH_SIZE = 100
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
  provider_signature?: string
}

interface TagTranslationJobPayload {
  tag_id: number
  locale: NonDefaultLocale
  source_name?: string
  source_hash?: string
  provider_signature?: string
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

interface TranslationMeta {
  source_hash: string | null
  is_manual: boolean
}

interface TranslationDiscoveryPage<TSource> {
  rawCount: number
  sourceRows: TSource[]
}

interface BuildTranslationJobRowInput<TSource> {
  sourceRow: TSource
  locale: NonDefaultLocale
  dedupeKey: string
  sourceHash: string
  providerSignature: string
  availableAt: string
}

interface TranslationDiscoveryConfig<TSource> {
  loadSourcePage: (offset: number) => Promise<TranslationDiscoveryPage<TSource>>
  loadTranslationMetaMap: (sourceRows: TSource[], locales: NonDefaultLocale[]) => Promise<Map<string, TranslationMeta>>
  getSourceId: (sourceRow: TSource) => string | number
  getSourceText: (sourceRow: TSource) => string
  buildJobRow: (input: BuildTranslationJobRowInput<TSource>) => JobUpsertRow
}

interface TranslationEnqueueStats {
  enqueuedEventJobs: number
  enqueuedTagJobs: number
  timeLimitReached: boolean
}

export async function GET(request: Request) {
  const stats: TranslationEnqueueStats = {
    enqueuedEventJobs: 0,
    enqueuedTagJobs: 0,
    timeLimitReached: false,
  }

  return handleCronRoute({
    request,
    jobName: 'translation-enqueue',
    handler: async () => {
      const [openRouterSettings, automaticTranslationsEnabled, enabledLocales] = await Promise.all([
        loadOpenRouterProviderSettings(),
        loadAutomaticTranslationsEnabled(),
        loadEnabledLocales(),
      ])
      const enabledTranslationLocales = enabledLocales.filter(isNonDefaultLocale)

      if (!openRouterSettings.configured || !openRouterSettings.apiKey) {
        return {
          success: true,
          skipped: true,
          reason: 'OpenRouter is not configured.',
          ...stats,
        }
      }

      if (!automaticTranslationsEnabled) {
        return {
          success: true,
          skipped: true,
          reason: 'Automatic translations are disabled in Locale Settings.',
          ...stats,
        }
      }

      if (enabledTranslationLocales.length === 0) {
        return {
          success: true,
          skipped: true,
          reason: 'No non-default locales are enabled in Locale Settings.',
          ...stats,
        }
      }

      const startedAt = Date.now()
      const providerSignature = buildProviderSignature(openRouterSettings.model)
      const discovery = await enqueueMissingOrOutdatedTranslationJobs(
        startedAt,
        enabledTranslationLocales,
        providerSignature,
      )

      stats.enqueuedEventJobs = discovery.enqueuedEventJobs
      stats.enqueuedTagJobs = discovery.enqueuedTagJobs
      stats.timeLimitReached = isTimeLimitReached(startedAt)

      return {
        success: true,
        ...stats,
      }
    },
    onError: error => buildCronJsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...stats,
    }, 500),
  })
}

function buildSourceHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function isNonDefaultLocale(value: string): value is NonDefaultLocale {
  return NON_DEFAULT_LOCALES.includes(value as NonDefaultLocale)
}

function isTimeLimitReached(startedAtMs: number) {
  return Date.now() - startedAtMs >= ENQUEUE_TIME_LIMIT_MS
}

function buildProviderSignature(model: string | undefined) {
  return `openrouter:${model?.trim() || 'automatic'}`
}

function buildJobConflictKey(jobType: string, dedupeKey: string) {
  return `${jobType}:${dedupeKey}`
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
    provider_signature: typeof value.provider_signature === 'string' ? value.provider_signature : undefined,
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
    provider_signature: typeof value.provider_signature === 'string' ? value.provider_signature : undefined,
  }
}

function getSourceHashFromUpsertPayload(payload: JobUpsertRow['payload']) {
  return typeof payload.source_hash === 'string' ? payload.source_hash : null
}

function getProviderSignatureFromUpsertPayload(payload: JobUpsertRow['payload']) {
  return typeof payload.provider_signature === 'string' ? payload.provider_signature : null
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

function getProviderSignatureFromStoredJobPayload(job: Pick<TranslationJobRow, 'job_type' | 'payload' | 'dedupe_key'>) {
  try {
    if (job.job_type === EVENT_TITLE_TRANSLATION_JOB_TYPE) {
      const parsed = parseEventJobPayload(job.payload, job.dedupe_key)
      return parsed.provider_signature ?? null
    }

    if (job.job_type === TAG_NAME_TRANSLATION_JOB_TYPE) {
      const parsed = parseTagJobPayload(job.payload, job.dedupe_key)
      return parsed.provider_signature ?? null
    }
  }
  catch {
    // Treat malformed payload as unknown provider signature.
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

    if (existingSourceHash !== nextSourceHash) {
      return true
    }

    return getProviderSignatureFromStoredJobPayload(existing) !== getProviderSignatureFromUpsertPayload(next.payload)
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

    const affectedRows = await db
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
        setWhere: sql`${jobsTable.status} NOT IN ('pending', 'processing')`,
      })
      .returning({ id: jobsTable.id })

    persistedRows += affectedRows.length
  }

  return persistedRows
}

function buildEventTranslationMetaMap(rows: EventTranslationMetaRow[]): Map<string, TranslationMeta> {
  const map = new Map<string, TranslationMeta>()

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

function buildTagTranslationMetaMap(rows: TagTranslationMetaRow[]): Map<string, TranslationMeta> {
  const map = new Map<string, TranslationMeta>()

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
  providerSignature: string,
): Promise<number> {
  return enqueueTranslationDiscoveryJobs(startedAtMs, maxJobs, locales, providerSignature, {
    loadSourcePage: loadEventSourcePage,
    loadTranslationMetaMap: loadEventTranslationMetaMap,
    getSourceId: sourceRow => sourceRow.id,
    getSourceText: sourceRow => sourceRow.title,
    buildJobRow: buildEventTranslationJobRow,
  })
}

async function enqueueTagDiscoveryJobs(
  startedAtMs: number,
  maxJobs: number,
  locales: NonDefaultLocale[],
  providerSignature: string,
): Promise<number> {
  return enqueueTranslationDiscoveryJobs(startedAtMs, maxJobs, locales, providerSignature, {
    loadSourcePage: loadTagSourcePage,
    loadTranslationMetaMap: loadTagTranslationMetaMap,
    getSourceId: sourceRow => sourceRow.id,
    getSourceText: sourceRow => sourceRow.name,
    buildJobRow: buildTagTranslationJobRow,
  })
}

async function enqueueTranslationDiscoveryJobs<TSource>(
  startedAtMs: number,
  maxJobs: number,
  locales: NonDefaultLocale[],
  providerSignature: string,
  config: TranslationDiscoveryConfig<TSource>,
): Promise<number> {
  if (maxJobs <= 0 || locales.length === 0) {
    return 0
  }

  let offset = 0
  let enqueued = 0

  while (enqueued < maxJobs && !isTimeLimitReached(startedAtMs)) {
    const page = await config.loadSourcePage(offset)
    if (page.rawCount === 0) {
      break
    }

    if (page.sourceRows.length > 0) {
      const metaMap = await config.loadTranslationMetaMap(page.sourceRows, locales)
      const availableAt = new Date().toISOString()
      const rowsToUpsert: JobUpsertRow[] = []
      let reachedJobLimit = false

      for (const sourceRow of page.sourceRows) {
        if (reachedJobLimit) {
          break
        }

        const sourceText = config.getSourceText(sourceRow)
        const sourceHash = buildSourceHash(sourceText)

        for (const locale of locales) {
          if (enqueued + rowsToUpsert.length >= maxJobs) {
            reachedJobLimit = true
            break
          }

          const key = `${config.getSourceId(sourceRow)}:${locale}`
          const existing = metaMap.get(key)
          if (existing?.is_manual || existing?.source_hash === sourceHash) {
            continue
          }

          rowsToUpsert.push(config.buildJobRow({
            sourceRow,
            locale,
            dedupeKey: key,
            sourceHash,
            providerSignature,
            availableAt,
          }))
        }
      }

      if (rowsToUpsert.length > 0) {
        enqueued += await upsertJobs(rowsToUpsert)
      }
    }

    if (page.rawCount < DISCOVERY_SCAN_PAGE_SIZE) {
      break
    }

    offset += page.rawCount
  }

  return enqueued
}

async function loadEventSourcePage(offset: number): Promise<TranslationDiscoveryPage<EventSourceRow>> {
  const events = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
    })
    .from(eventsTable)
    .orderBy(asc(eventsTable.id))
    .offset(offset)
    .limit(DISCOVERY_SCAN_PAGE_SIZE)

  return {
    rawCount: events.length,
    sourceRows: (events as EventSourceRow[])
      .map(row => ({
        id: row.id,
        title: typeof row.title === 'string' ? row.title.trim() : '',
      }))
      .filter(row => row.title.length > 0),
  }
}

async function loadTagSourcePage(offset: number): Promise<TranslationDiscoveryPage<TagSourceRow>> {
  const tags = await db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
    })
    .from(tagsTable)
    .orderBy(asc(tagsTable.id))
    .offset(offset)
    .limit(DISCOVERY_SCAN_PAGE_SIZE)

  return {
    rawCount: tags.length,
    sourceRows: (tags as TagSourceRow[])
      .map(row => ({
        id: row.id,
        name: typeof row.name === 'string' ? row.name.trim() : '',
      }))
      .filter(row => row.name.length > 0),
  }
}

async function loadEventTranslationMetaMap(sourceRows: EventSourceRow[], locales: NonDefaultLocale[]) {
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

  return buildEventTranslationMetaMap(translationRows as EventTranslationMetaRow[])
}

async function loadTagTranslationMetaMap(sourceRows: TagSourceRow[], locales: NonDefaultLocale[]) {
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

  return buildTagTranslationMetaMap(translationRows as TagTranslationMetaRow[])
}

function buildEventTranslationJobRow({
  sourceRow,
  locale,
  dedupeKey,
  sourceHash,
  providerSignature,
  availableAt,
}: BuildTranslationJobRowInput<EventSourceRow>): JobUpsertRow {
  return {
    job_type: EVENT_TITLE_TRANSLATION_JOB_TYPE,
    dedupe_key: dedupeKey,
    payload: {
      event_id: sourceRow.id,
      locale,
      source_title: sourceRow.title,
      source_hash: sourceHash,
      provider_signature: providerSignature,
    },
    status: 'pending',
    attempts: 0,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    available_at: availableAt,
    reserved_at: null,
    last_error: null,
  }
}

function buildTagTranslationJobRow({
  sourceRow,
  locale,
  dedupeKey,
  sourceHash,
  providerSignature,
  availableAt,
}: BuildTranslationJobRowInput<TagSourceRow>): JobUpsertRow {
  return {
    job_type: TAG_NAME_TRANSLATION_JOB_TYPE,
    dedupe_key: dedupeKey,
    payload: {
      tag_id: sourceRow.id,
      locale,
      source_name: sourceRow.name,
      source_hash: sourceHash,
      provider_signature: providerSignature,
    },
    status: 'pending',
    attempts: 0,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    available_at: availableAt,
    reserved_at: null,
    last_error: null,
  }
}

async function enqueueMissingOrOutdatedTranslationJobs(
  startedAtMs: number,
  locales: NonDefaultLocale[],
  providerSignature: string,
) {
  const perTypeTarget = Math.max(1, Math.floor(DISCOVERY_ENQUEUE_TARGET / 2))
  const enqueuedEventJobs = await enqueueEventDiscoveryJobs(startedAtMs, perTypeTarget, locales, providerSignature)
  const enqueuedTagJobs = await enqueueTagDiscoveryJobs(startedAtMs, perTypeTarget, locales, providerSignature)

  return {
    enqueuedEventJobs,
    enqueuedTagJobs,
  }
}
