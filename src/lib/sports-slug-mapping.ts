export interface SportsSlugSectionConfig {
  gamesEnabled: boolean
  propsEnabled: boolean
}

export interface SportsSlugMappingEntry {
  menuSlug: string
  h1Title: string
  label?: string | null
  aliases?: string[] | null
  mappedTags?: string[] | null
  sections: SportsSlugSectionConfig
}

export interface SportsSlugResolutionInput {
  sportsSportSlug?: string | null
  sportsTags?: string[] | null
}

export interface SportsSlugResolver {
  canonicalByAliasKey: Map<string, string>
  queryCandidatesBySlug: Map<string, Set<string>>
  h1TitleBySlug: Map<string, string>
  sectionsBySlug: Map<string, SportsSlugSectionConfig>
}

function stripDiacritics(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
}

function normalizeComparableValue(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
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

function registerAlias(
  resolver: SportsSlugResolver,
  alias: string,
  targetSlug: string,
) {
  const aliasKey = normalizeAliasKey(alias)
  if (!aliasKey) {
    return
  }

  const normalizedSlug = normalizeComparableValue(targetSlug)
  if (!normalizedSlug) {
    return
  }

  resolver.canonicalByAliasKey.set(aliasKey, normalizedSlug)

  const queryCandidates = resolver.queryCandidatesBySlug.get(normalizedSlug) ?? new Set<string>()
  queryCandidates.add(normalizedSlug)

  const directComparable = normalizeComparableValue(alias)
  if (directComparable) {
    queryCandidates.add(directComparable)
  }

  const asciiComparable = normalizeComparableValue(stripDiacritics(alias))
  if (asciiComparable) {
    queryCandidates.add(asciiComparable)
  }

  resolver.queryCandidatesBySlug.set(normalizedSlug, queryCandidates)
}

export function buildSportsSlugResolver(
  entries: SportsSlugMappingEntry[],
): SportsSlugResolver {
  const resolver: SportsSlugResolver = {
    canonicalByAliasKey: new Map(),
    queryCandidatesBySlug: new Map(),
    h1TitleBySlug: new Map(),
    sectionsBySlug: new Map(),
  }

  for (const entry of entries) {
    const canonicalSlug = normalizeComparableValue(entry.menuSlug)
    if (!canonicalSlug) {
      continue
    }

    const normalizedTitle = entry.h1Title?.trim()
    if (normalizedTitle) {
      resolver.h1TitleBySlug.set(canonicalSlug, normalizedTitle)
    }

    resolver.sectionsBySlug.set(canonicalSlug, {
      gamesEnabled: entry.sections.gamesEnabled,
      propsEnabled: entry.sections.propsEnabled,
    })

    registerAlias(resolver, canonicalSlug, canonicalSlug)

    if (entry.label?.trim()) {
      registerAlias(resolver, entry.label, canonicalSlug)
    }

    for (const alias of entry.aliases ?? []) {
      if (alias?.trim()) {
        registerAlias(resolver, alias, canonicalSlug)
      }
    }

    for (const mappedTag of entry.mappedTags ?? []) {
      if (mappedTag?.trim()) {
        registerAlias(resolver, mappedTag, canonicalSlug)
      }
    }
  }

  return resolver
}

function resolveAlias(
  resolver: SportsSlugResolver,
  value: string | null | undefined,
) {
  const aliasKey = normalizeAliasKey(value)
  if (!aliasKey) {
    return null
  }

  return resolver.canonicalByAliasKey.get(aliasKey) ?? null
}

export function resolveCanonicalSportsSlugAlias(
  resolver: SportsSlugResolver,
  alias: string | null | undefined,
) {
  return resolveAlias(resolver, alias)
}

export function resolveCanonicalSportsSportSlug(
  resolver: SportsSlugResolver,
  {
    sportsSportSlug,
    sportsTags,
  }: SportsSlugResolutionInput,
) {
  const tagCandidates = Array.isArray(sportsTags) ? sportsTags : []
  for (const candidate of tagCandidates) {
    const mappedSlug = resolveAlias(resolver, candidate)
    if (mappedSlug) {
      return mappedSlug
    }
  }

  return resolveAlias(resolver, sportsSportSlug)
}

export function resolveSportsSportSlugQueryCandidates(
  resolver: SportsSlugResolver,
  sportsSportSlug: string | null | undefined,
) {
  const canonicalSlug = resolveCanonicalSportsSportSlug(resolver, {
    sportsSportSlug,
    sportsTags: null,
  })

  if (!canonicalSlug) {
    return [] as string[]
  }

  return Array.from(resolver.queryCandidatesBySlug.get(canonicalSlug) ?? new Set([canonicalSlug]))
}

export function resolveSportsTitleBySlug(
  resolver: SportsSlugResolver,
  sportSlug: string | null | undefined,
) {
  const canonicalSlug = resolveCanonicalSportsSlugAlias(resolver, sportSlug)
  if (!canonicalSlug) {
    return null
  }

  return resolver.h1TitleBySlug.get(canonicalSlug) ?? null
}

export function resolveSportsSectionConfigBySlug(
  resolver: SportsSlugResolver,
  sportSlug: string | null | undefined,
) {
  const canonicalSlug = resolveCanonicalSportsSlugAlias(resolver, sportSlug)
  if (!canonicalSlug) {
    return null
  }

  return resolver.sectionsBySlug.get(canonicalSlug) ?? null
}
