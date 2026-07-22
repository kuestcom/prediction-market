import { connection, NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'

const RELATED_EVENTS_TIME_BUCKET_MS = 60_000

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection()
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const tagSlug = searchParams.get('tag') ?? undefined
  const localeParam = searchParams.get('locale') ?? DEFAULT_LOCALE
  const locale = SUPPORTED_LOCALES.includes(localeParam as typeof SUPPORTED_LOCALES[number])
    ? localeParam as typeof SUPPORTED_LOCALES[number]
    : DEFAULT_LOCALE
  const currentTimestamp = Math.floor(Date.now() / RELATED_EVENTS_TIME_BUCKET_MS) * RELATED_EVENTS_TIME_BUCKET_MS

  try {
    const { data: events, error } = await EventRepository.getRelatedEventsBySlug(slug, {
      tagSlug: tagSlug ?? undefined,
      locale,
      currentTimestamp,
    })
    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json(events)
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
