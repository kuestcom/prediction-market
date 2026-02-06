import { NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag') || 'trending'
  const search = searchParams.get('search') || ''
  const bookmarked = searchParams.get('bookmarked') === 'true'
  const status = searchParams.get('status') || 'active'
  const localeParam = searchParams.get('locale') ?? DEFAULT_LOCALE
  const locale = SUPPORTED_LOCALES.includes(localeParam as typeof SUPPORTED_LOCALES[number])
    ? localeParam as typeof SUPPORTED_LOCALES[number]
    : DEFAULT_LOCALE
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10)
  const clampedOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset)

  if (status !== 'active' && status !== 'resolved') {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 })
  }

  const user = await UserRepository.getCurrentUser()
  const userId = user?.id

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag,
      search,
      userId,
      bookmarked,
      status,
      offset: clampedOffset,
      locale,
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
