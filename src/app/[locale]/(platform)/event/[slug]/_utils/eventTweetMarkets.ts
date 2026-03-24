export type XTrackerPlatform = 'X' | 'TRUTH_SOCIAL'

export interface XTrackerSource {
  handle: string
  platform: XTrackerPlatform
}

export interface TweetMarketRange {
  minInclusive: number | null
  maxInclusive: number | null
}

interface TweetMarketTagLike {
  name?: string | null
  slug?: string | null
}

interface TweetMarketSourceLike {
  resolution_source?: string | null
  resolution_source_url?: string | null
}

interface TweetMarketRangeLike {
  short_title?: string | null
  title?: string | null
  slug?: string | null
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

function normalizeTweetMarketRangeInput(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/plus$/i, '+')
    ?? ''
}

function parseTweetMarketRangeValue(value: string | null | undefined): TweetMarketRange | null {
  const normalized = normalizeTweetMarketRangeInput(value)
  if (!normalized) {
    return null
  }

  const explicitRangeMatch = normalized.match(/^(\d+)-(\d+)$/)
  if (explicitRangeMatch) {
    const minInclusive = Number.parseInt(explicitRangeMatch[1], 10)
    const maxInclusive = Number.parseInt(explicitRangeMatch[2], 10)
    if (Number.isFinite(minInclusive) && Number.isFinite(maxInclusive) && minInclusive <= maxInclusive) {
      return { minInclusive, maxInclusive }
    }
  }

  const lessThanMatch = normalized.match(/^<(\d+)$/)
  if (lessThanMatch) {
    const upperExclusive = Number.parseInt(lessThanMatch[1], 10)
    if (Number.isFinite(upperExclusive) && upperExclusive > 0) {
      return {
        minInclusive: null,
        maxInclusive: upperExclusive - 1,
      }
    }
  }

  const plusMatch = normalized.match(/^(\d+)\+$/)
  if (plusMatch) {
    const minInclusive = Number.parseInt(plusMatch[1], 10)
    if (Number.isFinite(minInclusive)) {
      return {
        minInclusive,
        maxInclusive: null,
      }
    }
  }

  return null
}

function extractTweetMarketRangeFromSlug(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim().toLowerCase()
  if (!normalizedSlug) {
    return null
  }

  const slugRangeMatch = normalizedSlug.match(/(?:^|-)(\d+-\d+|\d+\+|\d+plus|<\d+)$/)
  return slugRangeMatch?.[1] ?? null
}

export function parseTweetMarketRange(market: TweetMarketRangeLike): TweetMarketRange | null {
  return parseTweetMarketRangeValue(market.short_title)
    ?? parseTweetMarketRangeValue(market.title)
    ?? parseTweetMarketRangeValue(extractTweetMarketRangeFromSlug(market.slug))
}

export function inferResolvedTweetMarketOutcome(
  market: TweetMarketRangeLike,
  totalCount: number | null | undefined,
  isFinal: boolean,
): 0 | 1 | null {
  if (typeof totalCount !== 'number' || !Number.isFinite(totalCount)) {
    return null
  }

  const range = parseTweetMarketRange(market)
  if (!range) {
    return null
  }

  if (range.maxInclusive != null && totalCount > range.maxInclusive) {
    return 1
  }

  const isWithinLowerBound = range.minInclusive == null || totalCount >= range.minInclusive
  const isWithinUpperBound = range.maxInclusive == null || totalCount <= range.maxInclusive
  if (!isFinal) {
    return null
  }

  return isWithinLowerBound && isWithinUpperBound ? 0 : 1
}
