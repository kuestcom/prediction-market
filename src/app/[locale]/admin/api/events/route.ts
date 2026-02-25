import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

type AdminEventsSortBy = 'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at'

const VALID_SORT_FIELDS: AdminEventsSortBy[] = [
  'title',
  'status',
  'volume',
  'volume_24h',
  'created_at',
  'updated_at',
]

export async function GET(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const limitParam = Number.parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 100)

    const offsetParam = Number.parseInt(searchParams.get('offset') || '0', 10)
    const offset = Number.isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0)

    const search = searchParams.get('search') || undefined
    const sortByParam = searchParams.get('sortBy')
    const sortOrderParam = searchParams.get('sortOrder')

    const sortBy = VALID_SORT_FIELDS.includes(sortByParam as AdminEventsSortBy)
      ? sortByParam as AdminEventsSortBy
      : 'updated_at'
    const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc'
      ? sortOrderParam
      : 'desc'

    const { data, error, totalCount } = await EventRepository.listAdminEvents({
      limit,
      offset,
      search,
      sortBy,
      sortOrder,
    })

    if (error) {
      console.error('Error listing admin events:', error)
      return NextResponse.json(
        {
          error: DEFAULT_ERROR_MESSAGE,
          ...(process.env.NODE_ENV !== 'production' ? { detail: error } : {}),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      data,
      totalCount,
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        error: DEFAULT_ERROR_MESSAGE,
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {}),
      },
      { status: 500 },
    )
  }
}
