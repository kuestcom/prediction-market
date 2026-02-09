import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAdminWallet } from '@/lib/admin'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { getSupabaseImageUrl } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const limitParam = Number.parseInt(searchParams.get('limit') || '50')
    const limit = Number.isNaN(limitParam) ? 50 : Math.min(limitParam, 100)

    const offsetParam = Number.parseInt(searchParams.get('offset') || '0')
    const offset = Number.isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0)
    const search = searchParams.get('search') || undefined
    const sortBy = (searchParams.get('sortBy') as 'username' | 'email' | 'address' | 'created_at') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    const validSortFields = ['username', 'email', 'address', 'created_at']
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json({ error: 'Invalid sortBy parameter' }, { status: 400 })
    }

    const { data, count, error } = await UserRepository.listUsers({
      limit,
      offset,
      search,
      sortBy,
      sortOrder,
    })

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const referredIds = Array.from(new Set((data ?? [])
      .map(user => user.referred_by_user_id)
      .filter((id): id is string => Boolean(id))))

    const { data: referredUsers } = await UserRepository.getUsersByIds(referredIds)
    const referredEntries = (referredUsers ?? []).filter((ref): ref is typeof ref & { username: string } => Boolean(ref.username))

    const referredMap = new Map<string, { username: string, address: string, proxy_wallet_address?: string | null, image?: string | null }>(
      referredEntries.map(referred => [referred.id, {
        username: referred.username,
        address: referred.address,
        proxy_wallet_address: referred.proxy_wallet_address,
        image: referred.image,
      }]),
    )

    const baseProfileUrl = (() => {
      const raw = process.env.SITE_URL!
      return raw.startsWith('http') ? raw : `https://${raw}`
    })()

    const transformedUsers = (data ?? []).map((user) => {
      const created = new Date(user.created_at)
      const createdLabel = Number.isNaN(created.getTime())
        ? '—'
        : created.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })

      const proxyWalletAddress = user.proxy_wallet_address
      const profilePath = user.username

      const referredSource = user.referred_by_user_id
        ? referredMap.get(user.referred_by_user_id)
        : undefined
      let referredDisplay: string | null = null
      let referredProfile: string | null = null

      if (user.referred_by_user_id && referredSource) {
        const referredPath = referredSource.username
        referredDisplay = referredSource.username
        referredProfile = `${baseProfileUrl}/@${referredPath}`
      }

      const searchText = [
        user.username,
        user.email,
        user.address,
        proxyWalletAddress,
        referredDisplay,
      ].filter(Boolean).join(' ').toLowerCase()

      return {
        ...user,
        is_admin: isAdminWallet(user.address),
        avatarUrl: user.image ? getSupabaseImageUrl(user.image) : '',
        referred_by_display: referredDisplay,
        referred_by_profile_url: referredProfile,
        created_label: createdLabel,
        profileUrl: `${baseProfileUrl}/@${profilePath}`,
        created_at: user.created_at,
        search_text: searchText,
      }
    })

    return NextResponse.json({
      data: transformedUsers,
      count: count || 0,
      totalCount: count || 0,
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
