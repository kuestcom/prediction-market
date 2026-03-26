const DIACRITICS_PATTERN = /[\u0300-\u036F]/g

export function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(DIACRITICS_PATTERN, '')
}

export function normalizeComparableValue(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

export function slugifyText(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugifySiteName(value: string, options: { fallback?: string | null } = {}) {
  const slug = slugifyText(value)
  if (slug) {
    return slug
  }

  const fallback = options.fallback?.trim()
  if (fallback) {
    return fallback
  }

  throw new Error('Site name must include at least one letter or number.')
}

export function normalizeAliasKey(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  return normalized || null
}
