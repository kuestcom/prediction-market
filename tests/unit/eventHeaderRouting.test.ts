import { describe, expect, it } from 'bun:test'

import { resolveEventHeaderSubcategoryHref } from '@/lib/event-header-routing'

describe('event header routing', () => {
  it('routes unstructured Sports children to prediction results', () => {
    expect(
      resolveEventHeaderSubcategoryHref({
        event: {},
        mainSlug: 'sports',
        subcategorySlug: 'HCL',
      }),
    ).toBe('/predictions/hcl')
  })

  it('keeps structured Sports children on sports routes', () => {
    expect(
      resolveEventHeaderSubcategoryHref({
        event: {
          sports_event_slug: 'lakers-celtics-2026-03-09',
          sports_sport_slug: 'nba',
        },
        mainSlug: 'sports',
        subcategorySlug: 'NBA',
      }),
    ).toBe('/sports/nba')
  })

  it('keeps non-dedicated category children on their category routes', () => {
    expect(
      resolveEventHeaderSubcategoryHref({
        event: {},
        mainSlug: 'politics',
        subcategorySlug: 'Brazil',
      }),
    ).toBe('/politics/brazil')
  })
})
