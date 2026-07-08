const X_HOSTNAMES = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
])

const X_RESERVED_PATH_SEGMENTS = new Set([
  'about',
  'account',
  'account_analytics',
  'account_automation',
  'account_access',
  'account_activity',
  'account_security',
  'account_your_data',
  'ads',
  'analytics',
  'business',
  'compose',
  'download',
  'explore',
  'hashtag',
  'help',
  'home',
  'i',
  'intent',
  'jobs',
  'login',
  'messages',
  'notifications',
  'oauth',
  'privacy',
  'robots.txt',
  'search',
  'settings',
  'share',
  'signup',
  'tos',
])

const URL_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i
const X_USERNAME_PATTERN = /^\w{1,15}$/

function normalizeXUsername(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^@+/, '')
  if (!normalized) {
    return null
  }

  if (!X_USERNAME_PATTERN.test(normalized) || X_RESERVED_PATH_SEGMENTS.has(normalized.toLowerCase())) {
    return null
  }

  return `@${normalized}`
}

function decodeUrlPathSegment(value: string) {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

export function normalizeXHandle(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const directHandle = normalizeXUsername(trimmed)
  if (directHandle) {
    return directHandle
  }

  const candidate = URL_PROTOCOL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  }
  catch {
    return null
  }

  if (!X_HOSTNAMES.has(url.hostname.toLowerCase())) {
    return null
  }

  const intentScreenName = url.pathname.toLowerCase() === '/intent/user'
    ? url.searchParams.get('screen_name')
    : null
  if (intentScreenName) {
    return normalizeXUsername(intentScreenName)
  }

  const pathSegments = url.pathname.split('/').filter(Boolean)
  if (pathSegments.length !== 1) {
    return null
  }

  return normalizeXUsername(decodeUrlPathSegment(pathSegments[0]))
}

export function resolveXShareAttribution({
  siteName,
  twitterLink,
}: {
  siteName: string | null | undefined
  twitterLink: string | null | undefined
}) {
  const handle = normalizeXHandle(twitterLink)
  if (handle) {
    return handle
  }

  return siteName?.trim() || null
}
