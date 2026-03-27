import { describe, expect, it } from 'vitest'
import { resolveEventMarketPath, resolveEventPagePath } from '@/lib/events-routing'

describe('events routing', () => {
  it('keeps sports games on sports routes', () => {
    const event = {
      slug: 'lakers-celtics-2026-03-09',
      sports_event_slug: 'lakers-celtics-2026-03-09',
      sports_sport_slug: 'nba',
      sports_section: 'games' as const,
    }

    expect(resolveEventPagePath(event)).toBe('/sports/nba/lakers-celtics-2026-03-09')
    expect(resolveEventMarketPath(event, 'moneyline')).toBe('/sports/nba/lakers-celtics-2026-03-09/moneyline')
  })

  it('routes esports games through esports paths when tagged accordingly', () => {
    const event = {
      slug: 'team-spirit-vs-faze-2026-03-09',
      sports_event_slug: 'team-spirit-vs-faze-2026-03-09',
      sports_sport_slug: 'counter-strike',
      sports_section: 'games' as const,
      tags: [
        { slug: 'esports' },
      ],
    }

    expect(resolveEventPagePath(event)).toBe('/esports/counter-strike/team-spirit-vs-faze-2026-03-09')
    expect(resolveEventMarketPath(event, 'match-winner')).toBe('/esports/counter-strike/team-spirit-vs-faze-2026-03-09/match-winner')
  })

  it('routes sports props through standard event pages', () => {
    const event = {
      slug: 'lebron-james-points-2026-03-09',
      sports_event_slug: 'lakers-celtics-2026-03-09',
      sports_sport_slug: 'nba',
      sports_section: 'props' as const,
    }

    expect(resolveEventPagePath(event)).toBe('/event/lebron-james-points-2026-03-09')
    expect(resolveEventMarketPath(event, 'over-27pt5')).toBe('/event/lebron-james-points-2026-03-09/over-27pt5')
  })

  it('infers props routing from tags when explicit sports section is absent', () => {
    const event = {
      slug: 'lebron-james-points-2026-03-09',
      sports_event_slug: 'lakers-celtics-2026-03-09',
      sports_sport_slug: 'nba',
      tags: [
        { slug: 'sports' },
        { slug: 'props' },
      ],
    }

    expect(resolveEventPagePath(event)).toBe('/event/lebron-james-points-2026-03-09')
  })
})
