import { z } from 'zod'
import siteUrlUtils from '@/lib/site-url'

const WALLET_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/i
const EmailSchema = z.email({ pattern: z.regexes.html5Email })
const { resolveSiteUrl } = siteUrlUtils

function normalizeEmailDomain(domain?: string | null) {
  return domain?.trim().toLowerCase() ?? ''
}

function getConfiguredPlaceholderEmailDomains() {
  try {
    const siteUrl = resolveSiteUrl(process.env)
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
