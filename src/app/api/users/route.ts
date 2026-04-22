import type { PublicProfile, User } from '@/types'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { checkRateLimit } from '@/lib/rate-limit'
import { getPublicAssetUrl } from '@/lib/storage'
import { getUserPublicAddress } from '@/lib/user-address'

export async function GET(request: NextRequest) {
  const ip
    = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'

  const { allowed, remaining } = checkRateLimit(`users-search:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  })

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('search')

  if (!query || query.length < 2) {
    return NextResponse.json([], {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    })
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
        image: user.image ? getPublicAssetUrl(user.image) : '',
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
