import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { fetchTopHoldersFromDataApi } from '@/lib/data-api/holders'
import { UserRepository } from '@/lib/db/queries/user'
import { getSupabaseImageUrl } from '@/lib/supabase'
import { normalizeAddress } from '@/lib/wallet'

interface HolderUser {
  id: string
  username: string
  proxy_wallet_address?: string | null
  image: string
  created_at?: string
}

interface Holder {
  user: HolderUser
  net_position: string
  outcome_index: number
  outcome_text: string
}

function normalizeAddressKey(address?: string | null) {
  const normalized = normalizeAddress(address)?.toLowerCase()
  return normalized || null
}

function normalizeAvatarUrl(image: string | null | undefined, fallbackAddress: string) {
  if (!image) {
    return `https://avatar.vercel.sh/${fallbackAddress}.png`
  }

  if (image.startsWith('http')) {
    return image
  }

  return getSupabaseImageUrl(image)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const conditionId = searchParams.get('conditionId') || searchParams.get('market')
  const yesToken = searchParams.get('yesToken') || undefined
  const noToken = searchParams.get('noToken') || undefined

  const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10)
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 500)

  if (!conditionId) {
    return NextResponse.json({ error: 'Missing conditionId.' }, { status: 400 })
  }

  try {
    const base = await fetchTopHoldersFromDataApi(conditionId, limit, { yesToken, noToken })

    const addressSet = new Set<string>()
    function collectAddresses(holders: Holder[]) {
      holders.forEach(({ user }) => {
        const proxy = normalizeAddressKey(user.proxy_wallet_address)

        if (proxy) {
          addressSet.add(proxy)
        }
      })
    }

    collectAddresses(base.yesHolders)
    collectAddresses(base.noHolders)

    const profileLookup = new Map<string, HolderUser>()

    if (addressSet.size > 0) {
      const { data: profiles, error } = await UserRepository.getUsersByAddresses(Array.from(addressSet))

      if (error) {
        console.error('Failed to load holder profiles', error)
      }

      for (const profile of profiles || []) {
        const fallbackAddress = profile.proxy_wallet_address ?? profile.address
        const normalizedAddress = normalizeAddressKey(profile.address)
        const normalizedProxyAddress = normalizeAddressKey(profile.proxy_wallet_address)
        const imageUrl = normalizeAvatarUrl(profile.image, fallbackAddress)
        const createdAt = profile.created_at
          ? new Date(profile.created_at).toISOString()
          : undefined
        const profileData: HolderUser = {
          id: profile.id,
          username: profile.username || fallbackAddress,
          proxy_wallet_address: profile.proxy_wallet_address ?? null,
          image: imageUrl,
          created_at: createdAt,
        }

        if (normalizedAddress) {
          profileLookup.set(normalizedAddress, profileData)
        }
        if (normalizedProxyAddress) {
          profileLookup.set(normalizedProxyAddress, profileData)
        }
      }
    }

    function hydrateHolders(holders: Holder[]) {
      return holders.map((holder) => {
        const lookupKeys = [
          normalizeAddressKey(holder.user.proxy_wallet_address),
        ].filter(Boolean) as string[]

        const matchedProfile = lookupKeys
          .map(key => profileLookup.get(key))
          .find(Boolean)

        const fallbackAddress = holder.user.proxy_wallet_address ?? holder.user.id
        const hydratedImage = normalizeAvatarUrl(
          matchedProfile?.image ?? holder.user.image,
          fallbackAddress,
        )

        return {
          ...holder,
          user: {
            ...holder.user,
            id: matchedProfile?.id ?? holder.user.id,
            username: matchedProfile?.username || holder.user.username,
            proxy_wallet_address: matchedProfile?.proxy_wallet_address ?? holder.user.proxy_wallet_address,
            image: hydratedImage,
            created_at: matchedProfile?.created_at ?? holder.user.created_at,
          },
        }
      })
    }

    return NextResponse.json({
      yesHolders: hydrateHolders(base.yesHolders),
      noHolders: hydrateHolders(base.noHolders),
    })
  }
  catch (error) {
    console.error('Failed to load holders', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
