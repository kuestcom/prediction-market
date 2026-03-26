import type { PlatformNavigationTag } from '@/lib/platform-navigation'
import { isDynamicHomeCategorySlug } from '@/lib/platform-routing'

export interface SearchCategoryMatch {
  href: string
  isMainCategory: boolean
  label: string
  slug: string
  score: number
}

export interface PredictionSearchContext {
  inputValue: string
  kind: 'main-tag' | 'child-tag' | 'query'
  label: string
  mainTag: string
  query: string
  slug: string
  tag: string
}

export function normalizePredictionSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .trim()
}

export function slugifyPredictionSearchValue(value: string) {
  return normalizePredictionSearchValue(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function humanizePredictionSearchSlug(value: string) {
  return slugifyPredictionSearchValue(value).replace(/-/g, ' ')
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase())
}

function getSearchMatchScore(value: string, query: string) {
  if (!value || !query) {
    return Number.POSITIVE_INFINITY
  }

  if (value === query) {
    return 0
  }

  if (value.startsWith(query)) {
    return 1
  }

  if (value.includes(query)) {
    return 2
  }

  return Number.POSITIVE_INFINITY
}

export function buildPredictionResultsPath(value: string) {
  const slug = slugifyPredictionSearchValue(value)
  if (!slug) {
    return null
  }

  return `/predictions/${slug}`
}

export function buildSearchCategoryMatches(tags: PlatformNavigationTag[], query: string): SearchCategoryMatch[] {
  const normalizedQuery = normalizePredictionSearchValue(query)
  if (!normalizedQuery) {
    return []
  }

  const matchesBySlug = new Map<string, SearchCategoryMatch>()

  function registerMatch({
    isMainCategory,
    label,
    slug,
  }: Omit<SearchCategoryMatch, 'href' | 'score'>) {
    const normalizedMatchSlug = slugifyPredictionSearchValue(slug)
    if (!normalizedMatchSlug) {
      return
    }

    const normalizedLabel = normalizePredictionSearchValue(label)
    const normalizedSlug = normalizePredictionSearchValue(normalizedMatchSlug.replace(/-/g, ' '))
    const score = Math.min(
      getSearchMatchScore(normalizedLabel, normalizedQuery),
      getSearchMatchScore(normalizedSlug, normalizedQuery),
    )

    if (!Number.isFinite(score)) {
      return
    }

    const href = buildPredictionResultsPath(normalizedMatchSlug)
    if (!href) {
      return
    }

    const existing = matchesBySlug.get(normalizedMatchSlug)
    if (!existing || score < existing.score || (score === existing.score && isMainCategory && !existing.isMainCategory)) {
      matchesBySlug.set(normalizedMatchSlug, {
        href,
        isMainCategory,
        label,
        slug: normalizedMatchSlug,
        score,
      })
    }
  }

  for (const tag of tags) {
    const isDynamicCategory = isDynamicHomeCategorySlug(tag.slug)

    if (isDynamicCategory) {
      registerMatch({
        isMainCategory: true,
        label: tag.name,
        slug: tag.slug,
      })
    }

    if (!isDynamicCategory) {
      continue
    }

    for (const child of tag.childs ?? []) {
      if (!child.slug.trim()) {
        continue
      }

      registerMatch({
        isMainCategory: false,
        label: child.name,
        slug: child.slug,
      })
    }
  }

  return Array.from(matchesBySlug.values()).sort((a, b) => (
    a.score - b.score
    || Number(b.isMainCategory) - Number(a.isMainCategory)
    || a.label.localeCompare(b.label)
  ))
}

export function resolvePredictionResultsHref(query: string, categories: SearchCategoryMatch[]) {
  const href = buildPredictionResultsPath(query)
  if (href) {
    return href
  }

  return categories[0]?.href ?? null
}

export function resolvePredictionSearchContext(tags: PlatformNavigationTag[], slug: string): PredictionSearchContext {
  const normalizedSlug = slugifyPredictionSearchValue(slug)
  const inputValue = humanizePredictionSearchSlug(slug)
  const reservedTag = tags.find(tag => slugifyPredictionSearchValue(tag.slug) === normalizedSlug)

  if (normalizedSlug === 'trending') {
    return {
      inputValue: '',
      kind: 'main-tag',
      label: reservedTag?.name ?? 'Trending',
      mainTag: 'trending',
      query: '',
      slug: normalizedSlug,
      tag: 'trending',
    }
  }

  if (normalizedSlug === 'new') {
    return {
      inputValue: '',
      kind: 'main-tag',
      label: reservedTag?.name ?? 'New',
      mainTag: 'new',
      query: '',
      slug: normalizedSlug,
      tag: 'new',
    }
  }

  for (const tag of tags) {
    if (!isDynamicHomeCategorySlug(tag.slug)) {
      continue
    }

    if (slugifyPredictionSearchValue(tag.slug) === normalizedSlug) {
      return {
        inputValue,
        kind: 'main-tag',
        label: tag.name,
        mainTag: tag.slug,
        query: '',
        slug: normalizedSlug,
        tag: tag.slug,
      }
    }

    const matchingChild = tag.childs.find(child => slugifyPredictionSearchValue(child.slug) === normalizedSlug)
    if (matchingChild) {
      return {
        inputValue,
        kind: 'child-tag',
        label: matchingChild.name,
        mainTag: tag.slug,
        query: '',
        slug: normalizedSlug,
        tag: matchingChild.slug,
      }
    }
  }

  const fallbackQuery = humanizePredictionSearchSlug(slug)

  return {
    inputValue: fallbackQuery,
    kind: 'query',
    label: fallbackQuery ? toTitleCase(fallbackQuery) : 'Predictions',
    mainTag: 'trending',
    query: fallbackQuery,
    slug: normalizedSlug,
    tag: 'trending',
  }
}
