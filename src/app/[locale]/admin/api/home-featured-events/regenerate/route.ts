import type { NextRequest } from 'next/server'
import type { SupportedLocale } from '@/i18n/locales'
import { sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { HomeFeaturedEventsRepository } from '@/lib/db/queries/home-featured-events'
import { UserRepository } from '@/lib/db/queries/user'
import { settings as settingsTable } from '@/lib/db/schema/settings/tables'
import { db } from '@/lib/drizzle'
import {
  buildHomeFeaturedSettingsUpdateRows,
  parseHomeFeaturedEventsPayload,
} from '@/lib/home-featured-admin'
import { regenerateHomeFeaturedEvents } from '@/lib/home-featured-ai'
import { validateHomeFeaturedSettingsInput } from '@/lib/home-featured-settings'

function resolveLocale(request: NextRequest) {
  const firstPathSegment = request.nextUrl.pathname.split('/').filter(Boolean)[0]
  return SUPPORTED_LOCALES.includes(firstPathSegment as SupportedLocale)
    ? firstPathSegment as SupportedLocale
    : DEFAULT_LOCALE
}

function readStringPayloadValue(value: unknown) {
  if (typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return typeof value === 'string' ? value : ''
}

function readPayloadObject(value: unknown) {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

async function readDraftPayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }

  const payload = await request.json().catch(() => null) as unknown
  return payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : null
}

async function persistDraftPayload(payload: Record<string, unknown> | null) {
  const rawSettings = payload?.settings
  const rawFeaturedEvents = payload?.featuredEvents
  let validatedSettings = null as ReturnType<typeof validateHomeFeaturedSettingsInput>['data'] | null
  let parsedFeaturedEvents = null as ReturnType<typeof parseHomeFeaturedEventsPayload>['data'] | null

  if (rawSettings && typeof rawSettings === 'object') {
    const settingsRecord = rawSettings as Record<string, unknown>
    const sideCardRecord = readPayloadObject(settingsRecord.sideCard)
    const validated = validateHomeFeaturedSettingsInput({
      enabled: readStringPayloadValue(settingsRecord.enabled),
      useAi: readStringPayloadValue(settingsRecord.useAi),
      maxCards: readStringPayloadValue(settingsRecord.maxCards),
      defaultContextMode: readStringPayloadValue(settingsRecord.defaultContextMode),
      newsSources: readStringPayloadValue(settingsRecord.newsSources),
      commentBlacklist: readStringPayloadValue(settingsRecord.commentBlacklist),
      minVolume24h: readStringPayloadValue(settingsRecord.minVolume24h),
      includeSportsToday: readStringPayloadValue(settingsRecord.includeSportsToday),
      includeNewEvents: readStringPayloadValue(settingsRecord.includeNewEvents),
      sideCardTitle: readStringPayloadValue(sideCardRecord.title ?? settingsRecord.sideCardTitle),
      sideCardText: readStringPayloadValue(sideCardRecord.text ?? settingsRecord.sideCardText),
      sideCardCtaLabel: readStringPayloadValue(sideCardRecord.ctaLabel ?? settingsRecord.sideCardCtaLabel),
      sideCardCtaHref: readStringPayloadValue(sideCardRecord.ctaHref ?? settingsRecord.sideCardCtaHref),
      sideCardIcon: readStringPayloadValue(sideCardRecord.icon ?? settingsRecord.sideCardIcon),
      sideCardUseAi: readStringPayloadValue(sideCardRecord.useAi ?? settingsRecord.sideCardUseAi),
    })

    if (!validated.data) {
      return { settings: null, error: validated.error ?? 'Invalid featured markets settings.' }
    }

    validatedSettings = validated.data
  }

  if (rawFeaturedEvents !== undefined) {
    const parsedEvents = parseHomeFeaturedEventsPayload(rawFeaturedEvents)
    if (!parsedEvents.data) {
      return { settings: null, error: parsedEvents.error ?? 'Invalid featured markets payload.' }
    }

    parsedFeaturedEvents = parsedEvents.data
  }

  if (validatedSettings && parsedFeaturedEvents) {
    const saveResult = await HomeFeaturedEventsRepository.replaceFeaturedEventsWithSettings(
      parsedFeaturedEvents,
      buildHomeFeaturedSettingsUpdateRows(validatedSettings),
    )
    if (saveResult.error) {
      return { settings: null, error: 'Could not save featured markets.' }
    }
  }
  else if (validatedSettings) {
    await db
      .insert(settingsTable)
      .values(buildHomeFeaturedSettingsUpdateRows(validatedSettings))
      .onConflictDoUpdate({
        target: [settingsTable.group, settingsTable.key],
        set: {
          value: sql`EXCLUDED.value`,
        },
      })

    revalidateTag(cacheTags.settings, { expire: 0 })
  }
  else if (parsedFeaturedEvents) {
    const replaceResult = await HomeFeaturedEventsRepository.replaceFeaturedEvents(parsedFeaturedEvents)
    if (replaceResult.error) {
      return { settings: null, error: 'Could not save featured markets.' }
    }
  }

  return { settings: validatedSettings, error: null }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const draftResult = await persistDraftPayload(await readDraftPayload(request))
    if (draftResult.error) {
      return NextResponse.json({ error: draftResult.error }, { status: 400 })
    }

    const result = await regenerateHomeFeaturedEvents(resolveLocale(request), {
      ...(draftResult.settings && { settings: draftResult.settings }),
    })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    revalidateTag(cacheTags.homeFeaturedEvents, { expire: 0 })
    revalidateTag(cacheTags.settings, { expire: 0 })
    revalidatePath('/', 'page')
    for (const locale of SUPPORTED_LOCALES) {
      revalidatePath(`/${locale}`, 'page')
    }

    return NextResponse.json({ items: result.data ?? [] })
  }
  catch (error) {
    console.error('Failed to regenerate home featured events', error)
    return NextResponse.json({ error: 'Could not regenerate featured markets.' }, { status: 500 })
  }
}
