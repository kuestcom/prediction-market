import { z } from 'zod'

const WALLET_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/i
const HAS_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i
const LOCAL_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i
const EmailSchema = z.email({ pattern: z.regexes.html5Email })

function normalizeEmailDomain(domain?: string | null) {
  return domain?.trim().toLowerCase() ?? ''
}

function getConfiguredPlaceholderEmailDomains() {
  const rawSiteUrl = process.env.SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (!rawSiteUrl) {
    return []
  }

  try {
    const siteUrl = HAS_PROTOCOL_PATTERN.test(rawSiteUrl)
      ? rawSiteUrl
      : `${LOCAL_HOST_PATTERN.test(rawSiteUrl) ? 'http' : 'https'}://${rawSiteUrl}`
    return [new URL(siteUrl).hostname]
  }
  catch {
    return []
  }
}

export function isWalletPlaceholderEmail(email?: string | null, placeholderDomains?: readonly string[]) {
  const rawEmail = email?.trim() ?? ''
  if (!rawEmail) {
    return false
  }

  const [localPart, domain, ...extraParts] = rawEmail.split('@')
  if (!localPart || !domain || extraParts.length > 0 || !WALLET_ADDRESS_PATTERN.test(localPart)) {
    return false
  }

  const normalizedDomain = normalizeEmailDomain(domain)
  const domains = placeholderDomains ?? getConfiguredPlaceholderEmailDomains()
  return domains.some(candidate => normalizeEmailDomain(candidate) === normalizedDomain)
}

export function hasUsableUserEmail(email?: string | null, placeholderDomains?: readonly string[]) {
  const rawEmail = email?.trim() ?? ''
  return Boolean(rawEmail && EmailSchema.safeParse(rawEmail).success && !isWalletPlaceholderEmail(rawEmail, placeholderDomains))
}
