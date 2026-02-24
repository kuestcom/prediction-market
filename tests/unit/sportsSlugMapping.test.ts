import { describe, expect, it } from 'vitest'
import {
  buildSportsSlugResolver,
  resolveCanonicalSportsSlugAlias,
  resolveCanonicalSportsSportSlug,
  resolveSportsSectionConfigBySlug,
  resolveSportsSportSlugQueryCandidates,
  resolveSportsTitleBySlug,
} from '@/lib/sports-slug-mapping'

const resolver = buildSportsSlugResolver([
  {
    menuSlug: 'bra',
    h1Title: 'Brazil Série A',
    label: 'Brazil Série A',
    aliases: ['brazil', 'brazil-serie-a'],
    mappedTags: ['Brazil Serie A'],
    sections: {
      gamesEnabled: true,
      propsEnabled: true,
    },
  },
  {
    menuSlug: 'psl',
    h1Title: 'Pakistan Super League',
    label: 'PSL',
    aliases: ['pakistan-super-league'],
    mappedTags: ['Pakistan Super League'],
    sections: {
      gamesEnabled: true,
      propsEnabled: false,
    },
  },
])

describe('sports slug mapping', () => {
  it('maps sports tags to canonical menu slug', () => {
    const slug = resolveCanonicalSportsSportSlug(resolver, {
      sportsSportSlug: 'soccer',
      sportsTags: ['Brazil Serie A', 'Games'],
    })

    expect(slug).toBe('bra')
  })

  it('maps url aliases to canonical menu slug', () => {
    const slug = resolveCanonicalSportsSlugAlias(resolver, 'brazil-serie-a')

    expect(slug).toBe('bra')
  })

  it('returns query candidates for a configured slug only', () => {
    const candidates = resolveSportsSportSlugQueryCandidates(resolver, 'bra')

    expect(candidates).toContain('bra')
    expect(candidates).toContain('brazil')
    expect(candidates).toContain('brazil serie a')
  })

  it('returns null/empty for unknown slugs (no fallback)', () => {
    const slug = resolveCanonicalSportsSportSlug(resolver, {
      sportsSportSlug: 'Custom League',
      sportsTags: null,
    })
    const candidates = resolveSportsSportSlugQueryCandidates(resolver, 'Custom League')

    expect(slug).toBeNull()
    expect(candidates).toEqual([])
  })

  it('resolves h1 and section config from canonical or alias slugs', () => {
    const title = resolveSportsTitleBySlug(resolver, 'brazil')
    const sections = resolveSportsSectionConfigBySlug(resolver, 'pakistan-super-league')

    expect(title).toBe('Brazil Série A')
    expect(sections).toEqual({ gamesEnabled: true, propsEnabled: false })
  })
})
