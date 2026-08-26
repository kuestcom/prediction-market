import { connection, NextResponse } from 'next/server'

import { resolveSupportedLocale } from '@/i18n/locales'
import { getNextHomeFeaturedSeriesRolloverEvent } from '@/lib/home-featured-events'

export async function GET(request: Request) {
  await connection()
  const { searchParams } = new URL(request.url)
  const currentEventSlug = searchParams.get('currentEventSlug')?.trim() ?? ''
  const locale = resolveSupportedLocale(searchParams.get('locale'))

  if (!currentEventSlug) {
    return NextResponse.json({ error: 'currentEventSlug is required' }, { status: 400 })
  }

  try {
    const nextEvent = await getNextHomeFeaturedSeriesRolloverEvent(currentEventSlug, locale)
    return NextResponse.json(
      { nextEvent },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('Failed to load the next home featured series event', error)
    return NextResponse.json({ error: 'Failed to load the next featured event' }, { status: 500 })
  }
}
