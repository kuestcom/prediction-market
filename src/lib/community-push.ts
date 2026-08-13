import { buildCommunityApiUrl } from '@/lib/community-url'

interface PushSubscriptionUpsertResponse {
  endpointHash?: string
  endpoint_hash?: string
  profileId?: string
  profile_id?: string
}

export async function getCommunityVapidPublicKey(communityApiUrl: string) {
  const response = await fetch(buildCommunityApiUrl(communityApiUrl, '/push/vapid-public-key'), {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error('Could not load the Web Push public key.')
  }
  const payload = (await response.json()) as { publicKey?: string; public_key?: string }
  const publicKey = payload.publicKey ?? payload.public_key
  if (!publicKey?.trim()) {
    throw new Error('The Web Push public key is unavailable.')
  }
  return publicKey.trim()
}

export async function upsertCommunityPushSubscription(options: {
  communityApiUrl: string
  token: string
  subscription: PushSubscription
  locale: string
  timezone: string
}) {
  const response = await fetch(buildCommunityApiUrl(options.communityApiUrl, '/push/subscriptions'), {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription: options.subscription.toJSON(),
      locale: options.locale,
      timezone: options.timezone,
    }),
  })
  if (!response.ok) {
    throw new Error('Could not enable trade alerts.')
  }
  const payload = (await response.json()) as PushSubscriptionUpsertResponse
  return {
    endpointHash:
      payload.endpointHash ?? payload.endpoint_hash ?? (await hashPushEndpoint(options.subscription.endpoint)),
    profileId: payload.profileId ?? payload.profile_id ?? null,
  }
}

export async function deleteCommunityPushSubscription(options: {
  communityApiUrl: string
  token: string
  endpointHash: string
}) {
  const response = await fetch(
    buildCommunityApiUrl(options.communityApiUrl, `/push/subscriptions/${encodeURIComponent(options.endpointHash)}`),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${options.token}` },
    },
  )
  if (!response.ok && response.status !== 404) {
    throw new Error('Could not disable trade alerts.')
  }
}

export async function hashPushEndpoint(endpoint: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
