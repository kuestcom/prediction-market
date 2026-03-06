import { normalizeAddress } from '@/lib/wallet'

const PLATFORM_RESERVED_ROOT_SLUGS = new Set([
  'activity',
  'event',
  'leaderboard',
  'mentions',
  'new',
  'portfolio',
  'profile',
  'r',
  'series',
  'settings',
  'sports',
  'terms-of-use',
])

const PLATFORM_NON_CATEGORY_MAIN_TAG_SLUGS = new Set(['trending'])

interface PlatformMainTagLike {
  slug: string
}

interface PlatformMainTagWithChildrenLike extends PlatformMainTagLike {
  childs: { name: string, slug: string }[]
}

export function normalizePlatformRootSlug(slug: string) {
  return slug.trim().toLowerCase()
}

export function isPlatformReservedRootSlug(slug: string) {
  return PLATFORM_RESERVED_ROOT_SLUGS.has(normalizePlatformRootSlug(slug))
}

export function isDynamicHomeCategorySlug(slug: string) {
  const normalizedSlug = normalizePlatformRootSlug(slug)

  return normalizedSlug.length > 0
    && !PLATFORM_NON_CATEGORY_MAIN_TAG_SLUGS.has(normalizedSlug)
    && !isPlatformReservedRootSlug(normalizedSlug)
    && !normalizedSlug.startsWith('@')
    && normalizeAddress(normalizedSlug) === null
}

export function buildDynamicHomeCategorySlugSet<T extends PlatformMainTagLike>(tags: T[]) {
  return new Set(
    tags
      .map(tag => normalizePlatformRootSlug(tag.slug))
      .filter(isDynamicHomeCategorySlug),
  )
}

export function findDynamicHomeCategoryBySlug<T extends PlatformMainTagLike>(tags: T[], slug: string): T | null {
  const normalizedSlug = normalizePlatformRootSlug(slug)

  return tags.find(tag => (
    normalizePlatformRootSlug(tag.slug) === normalizedSlug
    && isDynamicHomeCategorySlug(tag.slug)
  )) ?? null
}

export function findDynamicHomeSubcategoryBySlug<T extends PlatformMainTagWithChildrenLike>(
  tags: T[],
  categorySlug: string,
  subcategorySlug: string,
) {
  const category = findDynamicHomeCategoryBySlug(tags, categorySlug)
  if (!category) {
    return null
  }

  const normalizedSubcategorySlug = normalizePlatformRootSlug(subcategorySlug)
  const subcategory = category.childs.find(child => normalizePlatformRootSlug(child.slug) === normalizedSubcategorySlug) ?? null

  if (!subcategory) {
    return null
  }

  return {
    category,
    subcategory,
  }
}

export type NormalizedPublicProfileSlug
  = | { type: 'address', value: `0x${string}` }
    | { type: 'username', value: string }
    | { type: 'invalid', value: string }

export function normalizePublicProfileSlug(slug: string): NormalizedPublicProfileSlug {
  const trimmedSlug = slug.trim()
  if (!trimmedSlug) {
    return { type: 'invalid', value: trimmedSlug }
  }

  if (trimmedSlug.startsWith('@')) {
    const username = trimmedSlug.slice(1).trim()

    return username
      ? { type: 'username', value: username }
      : { type: 'invalid', value: trimmedSlug }
  }

  const normalizedAddress = normalizeAddress(trimmedSlug)
  if (normalizedAddress) {
    return { type: 'address', value: normalizedAddress }
  }

  return { type: 'invalid', value: trimmedSlug }
}

export function buildUsernameProfilePath(username: string): string | null {
  const trimmedUsername = username.trim().replace(/^@+/, '')
  if (!trimmedUsername || normalizeAddress(trimmedUsername)) {
    return null
  }

  return `/@${trimmedUsername}`
}

export function buildPublicProfilePath(slug: string): string | null {
  const trimmedSlug = slug.trim()
  if (!trimmedSlug) {
    return null
  }

  if (trimmedSlug.startsWith('@')) {
    return buildUsernameProfilePath(trimmedSlug)
  }

  const normalizedAddress = normalizeAddress(trimmedSlug)
  if (normalizedAddress) {
    return `/${normalizedAddress}`
  }

  return buildUsernameProfilePath(trimmedSlug)
}

export function getMainTagSeoTitle(name: string) {
  return `${name} Odds & Predictions`
}

export function getNewPageSeoTitle() {
  return getMainTagSeoTitle('New Events')
}
