import type { NonDefaultLocale } from '@/i18n/locales'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { loadAutomaticTranslationsEnabled } from '@/i18n/locale-settings'
import { LOCALE_LABELS, NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion } from '@/lib/ai/openrouter'
import { isCronAuthorized } from '@/lib/auth-cron'
import { supabaseAdmin } from '@/lib/supabase'

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
  available_at: string
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

    const { data: existingRows, error: existingRowsError } = await supabaseAdmin
      .from('jobs')
      .select('job_type,dedupe_key,status,payload')
      .in('job_type', [...TRANSLATION_JOB_TYPES])
      .in('dedupe_key', dedupeKeys)

    if (existingRowsError) {
      throw new Error(`Failed to inspect existing translation jobs: ${existingRowsError.message}`)
    }

    const existingMap = new Map<string, ExistingDiscoveryJobRow>()
    for (const existing of (existingRows ?? []) as ExistingDiscoveryJobRow[]) {
      existingMap.set(buildJobConflictKey(existing.job_type, existing.dedupe_key), existing)
    }

    const rowsToUpsert = chunk.filter((row) => {
      const key = buildJobConflictKey(row.job_type, row.dedupe_key)
      return shouldUpsertDiscoveryRow(existingMap.get(key), row)
    })

    if (rowsToUpsert.length === 0) {
      continue
    }

    const { error } = await supabaseAdmin
      .from('jobs')
      .upsert(rowsToUpsert, {
        onConflict: 'job_type,dedupe_key',
      })

    if (error) {
      throw new Error(`Failed to upsert translation discovery jobs: ${error.message}`)
    }

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

async function enqueueEventDiscoveryJobs(startedAtMs: number, maxJobs: number): Promise<number> {
  if (maxJobs <= 0) {
    return 0
  }

  let offset = 0
  let enqueued = 0

  while (enqueued < maxJobs && !isTimeLimitReached(startedAtMs)) {
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id,title')
      .order('id', { ascending: true })
      .range(offset, offset + DISCOVERY_SCAN_PAGE_SIZE - 1)

    if (eventsError) {
      throw new Error(`Failed to load events for translation discovery: ${eventsError.message}`)
    }

    const sourceRows = ((events ?? []) as EventSourceRow[])
      .map(row => ({
        id: row.id,
        title: typeof row.title === 'string' ? row.title.trim() : '',
      }))
      .filter(row => row.title.length > 0)

    if (!events?.length) {
      break
    }

    if (sourceRows.length > 0) {
      const eventIds = sourceRows.map(row => row.id)
      const { data: translationRows, error: translationRowsError } = await supabaseAdmin
        .from('event_translations')
        .select('event_id,locale,source_hash,is_manual')
        .in('event_id', eventIds)
        .in('locale', NON_DEFAULT_LOCALES)

      if (translationRowsError) {
        throw new Error(`Failed to load event translation metadata: ${translationRowsError.message}`)
      }

      const metaMap = buildEventTranslationMetaMap((translationRows ?? []) as EventTranslationMetaRow[])
      const availableAt = new Date().toISOString()
      const rowsToUpsert: JobUpsertRow[] = []
      let reachedJobLimit = false

      for (const sourceRow of sourceRows) {
        if (reachedJobLimit) {
          break
        }

        const sourceHash = buildSourceHash(sourceRow.title)

        for (const locale of NON_DEFAULT_LOCALES) {
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

async function enqueueTagDiscoveryJobs(startedAtMs: number, maxJobs: number): Promise<number> {
  if (maxJobs <= 0) {
    return 0
  }

  let offset = 0
  let enqueued = 0

  while (enqueued < maxJobs && !isTimeLimitReached(startedAtMs)) {
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from('tags')
      .select('id,name')
      .order('id', { ascending: true })
      .range(offset, offset + DISCOVERY_SCAN_PAGE_SIZE - 1)

    if (tagsError) {
      throw new Error(`Failed to load tags for translation discovery: ${tagsError.message}`)
    }

    const sourceRows = ((tags ?? []) as TagSourceRow[])
      .map(row => ({
        id: row.id,
        name: typeof row.name === 'string' ? row.name.trim() : '',
      }))
      .filter(row => row.name.length > 0)

    if (!tags?.length) {
      break
    }

    if (sourceRows.length > 0) {
      const tagIds = sourceRows.map(row => row.id)
      const { data: translationRows, error: translationRowsError } = await supabaseAdmin
        .from('tag_translations')
        .select('tag_id,locale,source_hash,is_manual')
        .in('tag_id', tagIds)
        .in('locale', NON_DEFAULT_LOCALES)

      if (translationRowsError) {
        throw new Error(`Failed to load tag translation metadata: ${translationRowsError.message}`)
      }

      const metaMap = buildTagTranslationMetaMap((translationRows ?? []) as TagTranslationMetaRow[])
      const availableAt = new Date().toISOString()
      const rowsToUpsert: JobUpsertRow[] = []
      let reachedJobLimit = false

      for (const sourceRow of sourceRows) {
        if (reachedJobLimit) {
          break
        }

        const sourceHash = buildSourceHash(sourceRow.name)

        for (const locale of NON_DEFAULT_LOCALES) {
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

async function enqueueMissingOrOutdatedTranslationJobs(startedAtMs: number) {
  const perTypeTarget = Math.max(1, Math.floor(DISCOVERY_ENQUEUE_TARGET / 2))
  const enqueuedEventJobs = await enqueueEventDiscoveryJobs(startedAtMs, perTypeTarget)
  const enqueuedTagJobs = await enqueueTagDiscoveryJobs(startedAtMs, perTypeTarget)

  return {
    enqueuedEventJobs,
    enqueuedTagJobs,
  }
}

async function fetchCandidateJobs(nowIso: string): Promise<TranslationJobRow[]> {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('id,job_type,dedupe_key,payload,status,attempts,max_attempts,available_at')
    .in('job_type', [...TRANSLATION_JOB_TYPES])
    .eq('status', 'pending')
    .lte('available_at', nowIso)
    .order('available_at', { ascending: true })
    .order('updated_at', { ascending: true })
    .limit(JOB_BATCH_SIZE)

  if (error) {
    throw new Error(`Failed to load translation jobs: ${error.message}`)
  }

  return (data ?? []) as TranslationJobRow[]
}

async function claimJob(job: TranslationJobRow, nowIso: string): Promise<TranslationJobRow | null> {
  if (!isTranslationJobType(job.job_type)) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .update({
      status: 'processing',
      reserved_at: nowIso,
      last_error: null,
    })
    .eq('id', job.id)
    .eq('job_type', job.job_type)
    .eq('status', 'pending')
    .lte('available_at', nowIso)
    .select('id,job_type,dedupe_key,payload,status,attempts,max_attempts,available_at')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to claim translation job #${job.id}: ${error.message}`)
  }

  return (data ?? null) as TranslationJobRow | null
}

async function completeJob(job: TranslationJobRow, payload: EventTranslationJobPayload | TagTranslationJobPayload) {
  const { error } = await supabaseAdmin
    .from('jobs')
    .update({
      status: 'completed',
      attempts: (job.attempts ?? 0) + 1,
      available_at: new Date().toISOString(),
      reserved_at: null,
      last_error: null,
      payload,
    })
    .eq('id', job.id)
    .eq('job_type', job.job_type)

  if (error) {
    throw new Error(`Failed to complete translation job #${job.id}: ${error.message}`)
  }
}

async function scheduleRetry(job: TranslationJobRow, rawError: unknown): Promise<{ retryScheduled: boolean }> {
  const attempts = (job.attempts ?? 0) + 1
  const maxAttempts = normalizeMaxAttempts(job.max_attempts)
  const exhausted = attempts >= maxAttempts
  const retryAt = exhausted
    ? new Date().toISOString()
    : new Date(Date.now() + buildBackoffMs(attempts)).toISOString()
  const message = rawError instanceof Error ? rawError.message : String(rawError)
  const truncatedMessage = message.slice(0, 1000)

  const { error } = await supabaseAdmin
    .from('jobs')
    .update({
      status: exhausted ? 'failed' : 'pending',
      attempts,
      available_at: retryAt,
      reserved_at: null,
      last_error: truncatedMessage,
    })
    .eq('id', job.id)
    .eq('job_type', job.job_type)

  if (error) {
    throw new Error(`Failed to reschedule translation job #${job.id}: ${error.message}`)
  }

  return { retryScheduled: !exhausted }
}

async function loadEventSourcesMap(eventIds: string[]) {
  const uniqueIds = [...new Set(eventIds)]
  const map = new Map<string, string>()
  if (uniqueIds.length === 0) {
    return map
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id,title')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(`Failed to load event sources for translation sync: ${error.message}`)
  }

  for (const row of (data ?? []) as EventSourceRow[]) {
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

  const { data, error } = await supabaseAdmin
    .from('tags')
    .select('id,name')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(`Failed to load tag sources for translation sync: ${error.message}`)
  }

  for (const row of (data ?? []) as TagSourceRow[]) {
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

  const { data, error } = await supabaseAdmin
    .from('event_translations')
    .select('event_id,locale,is_manual,source_hash')
    .in('event_id', uniqueEventIds)
    .in('locale', uniqueLocales)

  if (error) {
    throw new Error(`Failed to load event translation metadata for sync jobs: ${error.message}`)
  }

  return buildEventTranslationMetaMap((data ?? []) as EventTranslationMetaRow[])
}

async function loadTagTranslationMetaMapForJobs(tagIds: number[], locales: NonDefaultLocale[]) {
  const uniqueTagIds = [...new Set(tagIds)]
  const uniqueLocales = [...new Set(locales)]
  if (uniqueTagIds.length === 0 || uniqueLocales.length === 0) {
    return new Map<string, { source_hash: string | null, is_manual: boolean }>()
  }

  const { data, error } = await supabaseAdmin
    .from('tag_translations')
    .select('tag_id,locale,is_manual,source_hash')
    .in('tag_id', uniqueTagIds)
    .in('locale', uniqueLocales)

  if (error) {
    throw new Error(`Failed to load tag translation metadata for sync jobs: ${error.message}`)
  }

  return buildTagTranslationMetaMap((data ?? []) as TagTranslationMetaRow[])
}

async function upsertAutoEventTranslation(eventId: string, locale: NonDefaultLocale, title: string, sourceHash: string) {
  const { error } = await supabaseAdmin
    .from('event_translations')
    .upsert({
      event_id: eventId,
      locale,
      title,
      source_hash: sourceHash,
      is_manual: false,
    }, {
      onConflict: 'event_id,locale',
    })

  if (error) {
    throw new Error(`Failed to upsert event translation for ${eventId}/${locale}: ${error.message}`)
  }
}

async function upsertAutoTagTranslation(tagId: number, locale: NonDefaultLocale, name: string, sourceHash: string) {
  const { error } = await supabaseAdmin
    .from('tag_translations')
    .upsert({
      tag_id: tagId,
      locale,
      name,
      source_hash: sourceHash,
      is_manual: false,
    }, {
      onConflict: 'tag_id,locale',
    })

  if (error) {
    throw new Error(`Failed to upsert tag translation for ${tagId}/${locale}: ${error.message}`)
  }
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
    const [openRouterSettings, automaticTranslationsEnabled] = await Promise.all([
      loadOpenRouterProviderSettings(),
      loadAutomaticTranslationsEnabled(),
    ])

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

    const startedAt = Date.now()

    while (Date.now() - startedAt < SYNC_TIME_LIMIT_MS) {
      const nowIso = new Date().toISOString()
      const candidates = await fetchCandidateJobs(nowIso)

      if (!candidates.length) {
        const discovery = await enqueueMissingOrOutdatedTranslationJobs(startedAt)
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
