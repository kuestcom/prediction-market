const HAS_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i
const LOCAL_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i

function isVercelEnv(env = process.env) {
  return Boolean(
    env.VERCEL === '1'
    || env.VERCEL_ENV
    || env.VERCEL_URL
    || env.VERCEL_PROJECT_PRODUCTION_URL,
  )
}

function normalizeSiteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('SITE_URL must be a non-empty string')
  }

  const trimmed = value.trim()
  const withProtocol = HAS_PROTOCOL_PATTERN.test(trimmed)
    ? trimmed
    : `${LOCAL_HOST_PATTERN.test(trimmed) ? 'http' : 'https'}://${trimmed}`

  let parsed
  try {
    parsed = new URL(withProtocol)
  }
  catch {
    throw new Error(`SITE_URL is not a valid URL: "${value}"`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SITE_URL must start with http:// or https://')
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.protocol}//${parsed.host}${normalizedPath}${parsed.search}${parsed.hash}`
}

function resolveSiteUrl(env = process.env) {
  const explicitSiteUrl = typeof env.SITE_URL === 'string' && env.SITE_URL.trim()
    ? env.SITE_URL
    : null
  const vercelProductionUrl = typeof env.VERCEL_PROJECT_PRODUCTION_URL === 'string' && env.VERCEL_PROJECT_PRODUCTION_URL.trim()
    ? env.VERCEL_PROJECT_PRODUCTION_URL
    : null

  if (explicitSiteUrl) {
    return normalizeSiteUrl(explicitSiteUrl)
  }

  if (vercelProductionUrl) {
    return normalizeSiteUrl(vercelProductionUrl)
  }

  return 'http://localhost:3000'
}

module.exports = {
  isVercelEnv,
  normalizeSiteUrl,
  resolveSiteUrl,
}
