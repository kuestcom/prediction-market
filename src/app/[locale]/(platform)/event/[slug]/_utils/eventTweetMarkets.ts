export type XTrackerPlatform = 'X' | 'TRUTH_SOCIAL'

export interface XTrackerSource {
  handle: string
  platform: XTrackerPlatform
}

interface TweetMarketTagLike {
  name?: string | null
  slug?: string | null
}

interface TweetMarketSourceLike {
  resolution_source?: string | null
  resolution_source_url?: string | null
}

const TWEET_MARKETS_TAG_SLUGS = new Set(['tweet-markets', 'tweet-market'])
const XTRACKER_X_HOSTNAMES = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'])
const XTRACKER_TRUTH_SOCIAL_HOSTNAMES = new Set(['truthsocial.com', 'www.truthsocial.com'])
const IGNORED_SOCIAL_HANDLE_SEGMENTS = new Set(['home', 'i', 'intent', 'search', 'explore', 'notifications', 'messages'])

function parseXTrackerSource(value: string | null | undefined): XTrackerSource | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  }
  catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const platform = XTRACKER_TRUTH_SOCIAL_HOSTNAMES.has(host)
    ? 'TRUTH_SOCIAL'
    : XTRACKER_X_HOSTNAMES.has(host)
      ? 'X'
      : null

  if (!platform) {
    return null
  }

  const firstSegment = url.pathname.split('/').filter(Boolean)[0]
  if (!firstSegment) {
    return null
  }

  const normalizedHandle = firstSegment.replace(/^@+/, '').trim()
  if (!normalizedHandle || IGNORED_SOCIAL_HANDLE_SEGMENTS.has(normalizedHandle.toLowerCase())) {
    return null
  }

  return {
    handle: normalizedHandle,
    platform,
  }
}

export function resolveXTrackerSource(event: { markets: TweetMarketSourceLike[] }): XTrackerSource | null {
  for (const market of event.markets) {
    const resolved = parseXTrackerSource(market.resolution_source_url ?? market.resolution_source ?? null)
    if (resolved) {
      return resolved
    }
  }

  return null
}

export function isTweetMarketsEvent(event: { tags: TweetMarketTagLike[] }) {
  return event.tags.some((tag) => {
    const normalizedName = tag.name?.trim().toLowerCase()
    const normalizedSlug = tag.slug?.trim().toLowerCase()

    return normalizedName === 'tweet markets'
      || (normalizedSlug ? TWEET_MARKETS_TAG_SLUGS.has(normalizedSlug) : false)
  })
}
