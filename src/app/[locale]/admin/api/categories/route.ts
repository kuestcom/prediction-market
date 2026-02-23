import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { TagRepository } from '@/lib/db/queries/tag'
import { UserRepository } from '@/lib/db/queries/user'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const limit = Number.parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10)
    const search = searchParams.get('search') ?? undefined
    const sortByParam = searchParams.get('sortBy') as 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | null
    const sortOrderParam = searchParams.get('sortOrder') as 'asc' | 'desc' | null

    const { data, error, totalCount } = await TagRepository.listTags({
      limit: Number.isNaN(limit) ? 50 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
      search,
      sortBy: sortByParam ?? undefined,
      sortOrder: sortOrderParam ?? undefined,
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
