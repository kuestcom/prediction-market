import type { NonDefaultLocale } from '@/i18n/locales'
import { NON_DEFAULT_LOCALES } from '@/i18n/locales'

export interface EventTranslationJobPayload {
  event_id: string
  locale: NonDefaultLocale
  source_title?: string
  source_hash?: string
  provider_signature?: string
}

export interface TagTranslationJobPayload {
  tag_id: number
  locale: NonDefaultLocale
  source_name?: string
  source_hash?: string
  provider_signature?: string
}

export function isNonDefaultLocale(value: string): value is NonDefaultLocale {
  return NON_DEFAULT_LOCALES.includes(value as NonDefaultLocale)
}

function parseDecimalInteger(value: string) {
  if (!/^\d+$/.test(value)) {
    return Number.NaN
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN
}

export function parseEventJobPayload(payload: unknown, dedupeKey: string): EventTranslationJobPayload {
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

export function parseTagJobPayload(payload: unknown, dedupeKey: string): TagTranslationJobPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid payload for job ${dedupeKey}: expected object`)
  }

  const value = payload as Record<string, unknown>
  const rawTagId = value.tag_id
  const locale = typeof value.locale === 'string' ? value.locale : ''
  const parsedTagId = typeof rawTagId === 'number'
    ? rawTagId
    : typeof rawTagId === 'string'
      ? parseDecimalInteger(rawTagId)
      : Number.NaN

  if (!Number.isSafeInteger(parsedTagId) || parsedTagId <= 0) {
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
