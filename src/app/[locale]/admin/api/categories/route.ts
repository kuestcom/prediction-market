import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { TagRepository } from '@/lib/db/queries/tag'
import { UserRepository } from '@/lib/db/queries/user'

type AdminCategoriesSortBy = 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_markets_count'

const VALID_SORT_FIELDS: AdminCategoriesSortBy[] = [
  'name',
  'slug',
  'display_order',
  'created_at',
  'updated_at',
  'active_markets_count',
]

export async function GET(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const limitParam = Number.parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 100)

    const offsetParam = Number.parseInt(searchParams.get('offset') ?? '0', 10)
    const offset = Number.isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0)

    const search = searchParams.get('search')?.trim() || undefined
    const sortByParam = searchParams.get('sortBy')
    const sortOrderParam = searchParams.get('sortOrder')
    const mainOnly = searchParams.get('mainOnly') === '1'

    const sortBy = VALID_SORT_FIELDS.includes(sortByParam as AdminCategoriesSortBy)
      ? sortByParam as AdminCategoriesSortBy
      : 'display_order'
    const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc'
      ? sortOrderParam
      : 'asc'

    const { data, error, totalCount } = await TagRepository.listTags({
      limit,
      offset,
      search,
      sortBy,
      sortOrder,
      mainOnly,
    })

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json({
      data,
      totalCount,
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
