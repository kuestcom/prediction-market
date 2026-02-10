import type { NonDefaultLocale } from '@/i18n/locales'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { LOCALE_LABELS, NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion } from '@/lib/ai/openrouter'
import { isCronAuthorized } from '@/lib/auth-cron'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

const SYNC_TIME_LIMIT_MS = 250_000
const JOB_BATCH_SIZE = 20
const MAX_ATTEMPTS = 5

interface TranslationJobRow {
  event_id: string
  locale: NonDefaultLocale
  source_title: string
  source_hash: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  next_attempt_at: string
}

interface TranslationJobStats {
  scanned: number
  completed: number
  retried: number
  failed: number
  skippedManual: number
  timeLimitReached: boolean
  errors: { eventId: string, locale: string, error: string }[]
}

function buildTitleSourceHash(title: string) {
  return createHash('sha256').update(title).digest('hex')
}

function buildBackoffMs(attempts: number) {
  const seconds = Math.min(60 * 60, 2 ** Math.max(1, attempts))
  return seconds * 1000
}

function normalizeTranslatedTitle(value: string) {
  return value
    .trim()
    .replace(/^['"`“”‘’\s]+/, '')
    .replace(/['"`“”‘’\s]+$/, '')
    .trim()
}

async function fetchCandidateJobs(nowIso: string): Promise<TranslationJobRow[]> {
  const { data, error } = await supabaseAdmin
    .from('event_translation_jobs')
    .select('event_id,locale,source_title,source_hash,status,attempts,next_attempt_at')
    .in('locale', NON_DEFAULT_LOCALES)
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .order('updated_at', { ascending: true })
    .limit(JOB_BATCH_SIZE)

  if (error) {
    throw new Error(`Failed to load translation jobs: ${error.message}`)
  }

  return (data ?? []) as TranslationJobRow[]
}

async function claimJob(job: TranslationJobRow, nowIso: string): Promise<TranslationJobRow | null> {
  const { data, error } = await supabaseAdmin
    .from('event_translation_jobs')
    .update({
      status: 'processing',
      last_error: null,
    })
    .eq('event_id', job.event_id)
    .eq('locale', job.locale)
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', nowIso)
    .select('event_id,locale,source_title,source_hash,status,attempts,next_attempt_at')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to claim translation job (${job.event_id}/${job.locale}): ${error.message}`)
  }

  return (data ?? null) as TranslationJobRow | null
}

async function completeJob(job: TranslationJobRow, sourceTitle: string, sourceHash: string) {
  const { error } = await supabaseAdmin
    .from('event_translation_jobs')
    .update({
      status: 'completed',
      source_title: sourceTitle,
      source_hash: sourceHash,
      attempts: (job.attempts ?? 0) + 1,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('event_id', job.event_id)
    .eq('locale', job.locale)

  if (error) {
    throw new Error(`Failed to complete translation job (${job.event_id}/${job.locale}): ${error.message}`)
  }
}

async function scheduleRetry(job: TranslationJobRow, rawError: unknown): Promise<{ retryScheduled: boolean }> {
  const attempts = (job.attempts ?? 0) + 1
  const exhausted = attempts >= MAX_ATTEMPTS
  const retryAt = new Date(Date.now() + buildBackoffMs(attempts)).toISOString()
  const message = rawError instanceof Error ? rawError.message : String(rawError)
  const truncatedMessage = message.slice(0, 1000)

  const { error } = await supabaseAdmin
    .from('event_translation_jobs')
    .update({
      status: exhausted ? 'failed' : 'pending',
      attempts,
      next_attempt_at: retryAt,
      last_error: truncatedMessage,
    })
    .eq('event_id', job.event_id)
    .eq('locale', job.locale)

  if (error) {
    throw new Error(`Failed to reschedule translation job (${job.event_id}/${job.locale}): ${error.message}`)
  }

  return { retryScheduled: !exhausted }
}

async function loadCurrentSourceTitle(eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('title')
    .eq('id', eventId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load source title for event ${eventId}: ${error.message}`)
  }

  const title = typeof data?.title === 'string' ? data.title.trim() : ''
  if (!title) {
    throw new Error(`Event ${eventId} does not have a valid source title`)
  }

  return title
}

async function isManualTranslation(eventId: string, locale: NonDefaultLocale) {
  const { data, error } = await supabaseAdmin
    .from('event_translations')
    .select('is_manual')
    .eq('event_id', eventId)
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to inspect translation lock for ${eventId}/${locale}: ${error.message}`)
  }

  return Boolean(data?.is_manual)
}

async function upsertAutoTranslation(eventId: string, locale: NonDefaultLocale, title: string, sourceHash: string) {
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
    throw new Error(`Failed to upsert translation for ${eventId}/${locale}: ${error.message}`)
  }
}

async function translateTitle(sourceTitle: string, locale: NonDefaultLocale, model?: string, apiKey?: string) {
  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured.')
  }

  const localeLabel = LOCALE_LABELS[locale]

  const translated = await requestOpenRouterCompletion([
    {
      role: 'system',
      content: 'You are a translation engine specialized in short product/event titles. Return only the translated text.',
    },
    {
      role: 'user',
      content: [
        `Translate the following event title from English to ${localeLabel} (locale: ${locale}).`,
        'Rules:',
        '- Return only the translated title and nothing else.',
        '- Do not add quotes, bullet points, prefixes, suffixes, or explanations.',
        '- Preserve names, acronyms, tickers, numbers, and dates exactly when appropriate.',
        '- Keep the tone neutral and concise.',
        `Source title: ${sourceTitle}`,
      ].join('\n'),
    },
  ], {
    apiKey,
    model,
    temperature: 0,
    maxTokens: 120,
  })

  const normalized = normalizeTranslatedTitle(translated)
  if (!normalized) {
    throw new Error('Model returned an empty translated title.')
  }

  return normalized
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
    timeLimitReached: false,
    errors: [],
  }

  try {
    const settings = await loadMarketContextSettings()
    if (!settings.enabled || !settings.apiKey) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'OpenRouter is disabled or not configured.',
        ...stats,
      })
    }

    const startedAt = Date.now()

    while (Date.now() - startedAt < SYNC_TIME_LIMIT_MS) {
      const nowIso = new Date().toISOString()
      const candidates = await fetchCandidateJobs(nowIso)

      if (!candidates.length) {
        break
      }

      for (const candidate of candidates) {
        if (Date.now() - startedAt >= SYNC_TIME_LIMIT_MS) {
          stats.timeLimitReached = true
          break
        }

        stats.scanned += 1

        let claimed: TranslationJobRow | null = null

        try {
          claimed = await claimJob(candidate, nowIso)
          if (!claimed) {
            continue
          }

          if (await isManualTranslation(claimed.event_id, claimed.locale)) {
            const sourceTitle = await loadCurrentSourceTitle(claimed.event_id)
            const sourceHash = buildTitleSourceHash(sourceTitle)
            await completeJob(claimed, sourceTitle, sourceHash)
            stats.skippedManual += 1
            continue
          }

          const sourceTitle = await loadCurrentSourceTitle(claimed.event_id)
          const sourceHash = buildTitleSourceHash(sourceTitle)
          const translatedTitle = await translateTitle(sourceTitle, claimed.locale, settings.model, settings.apiKey)

          await upsertAutoTranslation(claimed.event_id, claimed.locale, translatedTitle, sourceHash)
          await completeJob(claimed, sourceTitle, sourceHash)

          stats.completed += 1
        }
        catch (error) {
          const eventId = claimed?.event_id ?? candidate.event_id
          const locale = claimed?.locale ?? candidate.locale

          stats.errors.push({
            eventId,
            locale,
            error: error instanceof Error ? error.message : String(error),
          })

          if (!claimed) {
            stats.failed += 1
            continue
          }

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
            stats.errors.push({
              eventId,
              locale,
              error: rescheduleError instanceof Error ? rescheduleError.message : String(rescheduleError),
            })
          }
        }
      }

      if (stats.timeLimitReached) {
        break
      }
    }

    return NextResponse.json({
      success: true,
      ...stats,
    })
  }
  catch (error) {
    console.error('event-title-translation-sync failed', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...stats,
    }, { status: 500 })
  }
}
