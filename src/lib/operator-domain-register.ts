import siteUrlUtils from '@/lib/site-url'

const DEFAULT_REGISTER_ENDPOINT = 'https://kuest.com/api/domain-register'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const REQUEST_TIMEOUT_MS = 2_500
const { resolveSiteUrl } = siteUrlUtils

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  return LOCAL_HOSTNAMES.has(normalized)
    || normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
}

function resolvePublicSiteUrl() {
  try {
    const siteUrl = resolveSiteUrl(process.env)
    const parsed = new URL(siteUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    if (isLocalHostname(parsed.hostname)) {
      return null
    }

    return parsed.origin
  }
  catch {
    return null
  }
}

function getRegisterEndpoint() {
  return process.env.OPERATOR_DOMAIN_REGISTER_ENDPOINT?.trim() || DEFAULT_REGISTER_ENDPOINT
}

export async function reportOperatorDomainSnapshot() {
  const siteUrl = resolvePublicSiteUrl()
  if (!siteUrl) {
    return
  }

  const endpoint = getRegisterEndpoint()
  if (!endpoint) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: siteUrl,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(
        '[operator-domain-register] Failed to report domain snapshot.',
        `status=${response.status}`,
      )
    }
  }
  catch (error) {
    console.warn(
      '[operator-domain-register] Failed to report domain snapshot.',
      error instanceof Error ? error.message : error,
    )
  }
  finally {
    clearTimeout(timeout)
  }
}
