const PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i

function hasProtocol(value) {
  return PROTOCOL_PATTERN.test(value)
}

function getHostname(value) {
  const host = value.split('/')[0] || ''
  return (host.split(':')[0] || '').toLowerCase()
}

function shouldUseHttpProtocol(value) {
  const hostname = getHostname(value)
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.endsWith('.local')
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    throw new Error('Base URL cannot be empty')
  }

  const withProtocol = hasProtocol(trimmed)
    ? trimmed
    : `${shouldUseHttpProtocol(trimmed) ? 'http' : 'https'}://${trimmed}`

  const url = new URL(withProtocol)
  const pathname = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${pathname === '/' ? '' : pathname}`
}

function resolveSiteUrl(env = process.env) {
  if (env.SITE_URL) {
    try {
      return normalizeBaseUrl(env.SITE_URL)
    }
    catch {
      // fall through to Vercel auto-resolution when available
    }
  }

  const vercelHost = env.VERCEL_ENV === 'production'
    ? env.VERCEL_PROJECT_PRODUCTION_URL
    : env.VERCEL_URL || env.VERCEL_PROJECT_PRODUCTION_URL

  if (!vercelHost) {
    return null
  }

  try {
    return normalizeBaseUrl(vercelHost)
  }
  catch {
    return null
  }
}

function resolveSchedulerTarget(pathname, env = process.env) {
  const baseUrl = resolveSiteUrl(env)
  if (!baseUrl) {
    return null
  }

  const url = new URL(baseUrl)
  const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  url.pathname = `${basePath}${normalizedPath}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

module.exports = {
  normalizeBaseUrl,
  resolveSiteUrl,
  resolveSchedulerTarget,
}
