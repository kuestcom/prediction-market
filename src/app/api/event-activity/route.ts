import type { ActivityOrder } from '@/types'
import { NextResponse } from 'next/server'
import { filterActivitiesByMinAmount } from '@/lib/activity/filter'
import { DEFAULT_ERROR_MESSAGE, MICRO_UNIT } from '@/lib/constants'
import { EVENT_ACTIVITY_PAGE_SIZE } from '@/lib/data-api/trades'
import { mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'
import { UserRepository } from '@/lib/db/queries/user'
import { getSupabaseImageUrl } from '@/lib/supabase'
import { normalizeAddress } from '@/lib/wallet'

const DATA_API_URL = process.env.DATA_URL!

interface DataApiActivity {
  proxyWallet?: string
  timestamp?: number
  conditionId?: string
  type?: string
  size?: number
  usdcSize?: number
  transactionHash?: string
  price?: number
  asset?: string
  side?: string
  outcomeIndex?: number
  title?: string
  slug?: string
  icon?: string
  eventSlug?: string
  outcome?: string
  name?: string
  pseudonym?: string
  profileImage?: string
  profileImageOptimized?: string
}

function normalizeAvatarUrl(image: string | null | undefined) {
  if (!image) {
    return ''
  }

  if (image.startsWith('http')) {
    return image
  }

  return getSupabaseImageUrl(image)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market')
  const parsedLimit = Number.parseInt(searchParams.get('limit') || `${EVENT_ACTIVITY_PAGE_SIZE}`, 10)
  const parsedOffset = Number.parseInt(searchParams.get('offset') || '0', 10)
  const parsedFilterAmount = Number.parseFloat(searchParams.get('filterAmount') || '0')

  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : EVENT_ACTIVITY_PAGE_SIZE
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
  const hasFilterAmount = Number.isFinite(parsedFilterAmount) && parsedFilterAmount > 0

  if (!market) {
    return NextResponse.json({ error: 'Missing market parameter.' }, { status: 400 })
  }

  if (!DATA_API_URL) {
    return NextResponse.json({ error: 'DATA_URL environment variable is not configured.' }, { status: 500 })
  }

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      market,
      takerOnly: 'false',
    })

    if (hasFilterAmount) {
      params.set('filterType', 'CASH')
      params.set('filterAmount', parsedFilterAmount.toString())
    }

    const response = await fetch(`${DATA_API_URL}/trades?${params.toString()}`)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      const errorMessage = errorBody?.error || DEFAULT_ERROR_MESSAGE
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    const result = await response.json()
    if (!Array.isArray(result)) {
      return NextResponse.json({ error: 'Unexpected response from data service.' }, { status: 500 })
    }

    const activities = (result as DataApiActivity[]).map(mapDataApiActivityToActivityOrder)
    const minAmount = hasFilterAmount ? parsedFilterAmount * MICRO_UNIT : undefined
    const filtered = filterActivitiesByMinAmount(activities, minAmount)

    const addressSet = new Set<string>()
    filtered.forEach((activity) => {
      const normalized = normalizeAddress(activity.user.address)?.toLowerCase()
      if (normalized) {
        addressSet.add(normalized)
      }
    })

    const profileLookup = new Map<string, { username?: string | null, image?: string | null, created_at?: string }>()

    if (addressSet.size > 0) {
      const { data: profiles, error } = await UserRepository.getUsersByAddresses(Array.from(addressSet))

      if (error) {
        console.error('Failed to load activity profiles', error)
      }

      for (const profile of profiles || []) {
        const normalizedAddress = normalizeAddress(profile.address)?.toLowerCase()
        const normalizedProxy = normalizeAddress(profile.proxy_wallet_address)?.toLowerCase()
        const imageUrl = normalizeAvatarUrl(profile.image)

        const createdAt = profile.created_at
          ? new Date(profile.created_at).toISOString()
          : undefined

        if (normalizedAddress) {
          profileLookup.set(normalizedAddress, { username: profile.username, image: imageUrl, created_at: createdAt })
        }
        if (normalizedProxy) {
          profileLookup.set(normalizedProxy, { username: profile.username, image: imageUrl, created_at: createdAt })
        }
      }
    }

    const hydrated: ActivityOrder[] = filtered.map((activity) => {
      const normalized = normalizeAddress(activity.user.address)?.toLowerCase()
      const matchedProfile = normalized ? profileLookup.get(normalized) : null
      const fallbackAddress = activity.user.address || activity.user.id

      const username = matchedProfile?.username || activity.user.username || fallbackAddress || 'trader'
      const image = normalizeAvatarUrl(matchedProfile?.image || activity.user.image)

      return {
        ...activity,
        user: {
          ...activity.user,
          username,
          image,
          created_at: matchedProfile?.created_at,
        },
      }
    })

    return NextResponse.json(hydrated)
  }
  catch (error) {
    console.error('Failed to load event activity', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
