import { normalizeAliasKey, normalizeComparableValue, stripDiacritics } from '@/lib/slug'

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
  queryCandidates?: string[] | null
  sections: SportsSlugSectionConfig
  useForEventClassification?: boolean
}

export interface SportsSlugResolutionInput {
  sportsSportSlug?: string | null
  sportsSeriesSlug?: string | null
  sportsTags?: string[] | null
}

export interface SportsSlugResolver {
  canonicalByAliasKey: Map<string, string>
  classificationByAliasKey: Map<string, string>
  queryCandidatesBySlug: Map<string, Set<string>>
  h1TitleBySlug: Map<string, string>
  sectionsBySlug: Map<string, SportsSlugSectionConfig>
}

export { normalizeAliasKey }

function addQueryCandidate(
  resolver: SportsSlugResolver,
  targetSlug: string,
  value: string,
) {
  const normalizedSlug = normalizeComparableValue(targetSlug)
  if (!normalizedSlug) {
    return
  }

  const queryCandidates = resolver.queryCandidatesBySlug.get(normalizedSlug) ?? new Set<string>()
  const directComparable = normalizeComparableValue(value)
  if (directComparable) {
    queryCandidates.add(directComparable)
  }

  const asciiComparable = normalizeComparableValue(stripDiacritics(value))
  if (asciiComparable) {
    queryCandidates.add(asciiComparable)
  }

  resolver.queryCandidatesBySlug.set(normalizedSlug, queryCandidates)
}

function registerAlias(
  target: Map<string, string>,
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

  target.set(aliasKey, normalizedSlug)
}

export function buildSportsSlugResolver(
  entries: SportsSlugMappingEntry[],
): SportsSlugResolver {
  const resolver: SportsSlugResolver = {
    canonicalByAliasKey: new Map(),
    classificationByAliasKey: new Map(),
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

    addQueryCandidate(resolver, canonicalSlug, canonicalSlug)
    registerAlias(resolver.canonicalByAliasKey, canonicalSlug, canonicalSlug)
    if (entry.useForEventClassification !== false) {
      registerAlias(resolver.classificationByAliasKey, canonicalSlug, canonicalSlug)
    }

    if (entry.label?.trim()) {
      registerAlias(resolver.canonicalByAliasKey, entry.label, canonicalSlug)
      addQueryCandidate(resolver, canonicalSlug, entry.label)
      if (entry.useForEventClassification !== false) {
        registerAlias(resolver.classificationByAliasKey, entry.label, canonicalSlug)
      }
    }

    for (const alias of entry.aliases ?? []) {
      if (alias?.trim()) {
        registerAlias(resolver.canonicalByAliasKey, alias, canonicalSlug)
        addQueryCandidate(resolver, canonicalSlug, alias)
        if (entry.useForEventClassification !== false) {
          registerAlias(resolver.classificationByAliasKey, alias, canonicalSlug)
        }
      }
    }

    for (const mappedTag of entry.mappedTags ?? []) {
      if (mappedTag?.trim()) {
        registerAlias(resolver.canonicalByAliasKey, mappedTag, canonicalSlug)
        addQueryCandidate(resolver, canonicalSlug, mappedTag)
        if (entry.useForEventClassification !== false) {
          registerAlias(resolver.classificationByAliasKey, mappedTag, canonicalSlug)
        }
      }
    }

    for (const queryCandidate of entry.queryCandidates ?? []) {
      if (queryCandidate?.trim()) {
        addQueryCandidate(resolver, canonicalSlug, queryCandidate)
      }
    }
  }

  return resolver
}

function resolveAlias(
  aliasMap: Map<string, string>,
  value: string | null | undefined,
) {
  const aliasKey = normalizeAliasKey(value)
  if (!aliasKey) {
    return null
  }

  return aliasMap.get(aliasKey) ?? null
}

export function resolveCanonicalSportsSlugAlias(
  resolver: SportsSlugResolver,
  alias: string | null | undefined,
) {
  return resolveAlias(resolver.canonicalByAliasKey, alias)
}

export function resolveCanonicalSportsSportSlug(
  resolver: SportsSlugResolver,
  {
    sportsSportSlug,
    sportsSeriesSlug,
    sportsTags,
  }: SportsSlugResolutionInput,
) {
  const tagCandidates = Array.isArray(sportsTags) ? sportsTags : []
  for (const candidate of tagCandidates) {
    const mappedSlug = resolveAlias(resolver.classificationByAliasKey, candidate)
    if (mappedSlug) {
      return mappedSlug
    }
  }

  const resolvedSportSlug = resolveAlias(resolver.classificationByAliasKey, sportsSportSlug)
  if (resolvedSportSlug) {
    return resolvedSportSlug
  }

  return resolveAlias(resolver.classificationByAliasKey, sportsSeriesSlug)
}

export function resolveSportsSportSlugQueryCandidates(
  resolver: SportsSlugResolver,
  sportsSportSlug: string | null | undefined,
) {
  const canonicalSlug = resolveCanonicalSportsSlugAlias(resolver, sportsSportSlug)

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
