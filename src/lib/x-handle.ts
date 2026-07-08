const X_HOSTNAMES = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
])

const X_RESERVED_PATH_SEGMENTS = new Set([
  'compose',
  'explore',
  'hashtag',
  'home',
  'i',
  'intent',
  'login',
  'messages',
  'notifications',
  'search',
  'settings',
  'share',
  'signup',
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

  const intentScreenName = url.pathname.toLowerCase().startsWith('/intent/user')
    ? url.searchParams.get('screen_name')
    : null
  if (intentScreenName) {
    return normalizeXUsername(intentScreenName)
  }

  const firstSegment = url.pathname.split('/').filter(Boolean)[0]
  if (!firstSegment) {
    return null
  }

  return normalizeXUsername(decodeUrlPathSegment(firstSegment))
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
