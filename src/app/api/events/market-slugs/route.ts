import { NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag')?.trim() || 'trending'
  const localeParam = searchParams.get('locale') ?? DEFAULT_LOCALE
  const locale = SUPPORTED_LOCALES.includes(localeParam as typeof SUPPORTED_LOCALES[number])
    ? localeParam as typeof SUPPORTED_LOCALES[number]
    : DEFAULT_LOCALE
  const sportsSportSlug = searchParams.get('sportsSportSlug')?.trim() || ''
  const sportsSectionParam = searchParams.get('sportsSection')?.trim().toLowerCase() || ''
  const sportsSection = sportsSectionParam === 'games' || sportsSectionParam === 'props'
    ? sportsSectionParam
    : ''
  const status = searchParams.get('status') === 'resolved' ? 'resolved' : 'active'

  try {
    const { data, error } = await EventRepository.listEventMarketSlugs({
      tag,
      locale,
      limit: 80,
      sportsSportSlug,
      sportsSection,
      status,
    })

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  }
  catch (error) {
    console.error('Market slugs API error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
