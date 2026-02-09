import type { PublicProfile, User } from '@/types'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { getSupabaseImageUrl } from '@/lib/supabase'
import { getUserPublicAddress } from '@/lib/user-address'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('search')

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  try {
    const { data, error } = await UserRepository.listUsers({
      search: query,
      limit: 10,
      sortBy: 'username',
      sortOrder: 'asc',
      searchByUsernameOnly: true,
    })

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const profiles: PublicProfile[] = (data || []).map((user) => {
      return {
        address: getUserPublicAddress(user as unknown as User) || '',
        proxy_wallet_address: user.proxy_wallet_address ?? null,
        username: user.username!,
        image: user.image ? getSupabaseImageUrl(user.image) : '',
        created_at: new Date(user.created_at),
      }
    })

    return NextResponse.json(profiles)
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
