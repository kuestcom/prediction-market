import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/market-context-config', () => ({
  loadOpenRouterProviderSettings: vi.fn(async () => ({ apiKey: '', model: '' })),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  requestOpenRouterCompletion: vi.fn(),
}))

describe('sports source providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses admin-provided provider auth when suggesting sports events', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      event: [
        {
          idEvent: '123',
          idLeague: '4328',
          strLeague: 'Premier League',
          strSport: 'Soccer',
          strHomeTeam: 'Arsenal',
          strAwayTeam: 'Chelsea',
          strTimestamp: '2028-05-01T19:00:00Z',
          strVideo: 'https://www.youtube.com/watch?v=highlight',
        },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { suggestSportsEvents } = await import('@/lib/sports-source')
    const candidates = await suggestSportsEvents({
      title: 'Arsenal vs Chelsea',
      outcomes: ['Arsenal', 'Chelsea'],
      auth: { theSportsDbApiKey: 'admin-tsdb-key' },
      limit: 3,
    })

    const requestUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(requestUrl).toContain('/api/v1/json/admin-tsdb-key/searchevents.php')
    expect(candidates[0]?.eventId).toBe('123')
    expect(candidates[0]?.livestreamUrl).toBeNull()
  })

  it('rejects explicit provider values when none are supported', async () => {
    const { resolveSportsSourceProviderParam } = await import('@/lib/sports-source/providers')

    expect(resolveSportsSourceProviderParam({ provider: 'legacy', category: 'sports' })).toEqual({
      provider: null,
      error: 'Unsupported sports source provider. Use one of: thesportsdb, pandascore.',
    })
    expect(resolveSportsSourceProviderParam({ provider: 'pandascore,legacy', category: 'sports' })).toEqual({
      provider: null,
      error: 'Unsupported sports source provider. Use one of: thesportsdb, pandascore.',
    })
  })

  it('normalizes shared provider rules for sports and esports endpoints', async () => {
    const {
      filterSportsSourceProvidersByCategory,
      getConfiguredSportsSourceProviders,
      resolveSportsSourceProviderParam,
    } = await import('@/lib/sports-source/providers')

    expect(resolveSportsSourceProviderParam({ provider: 'TheSportsDB pandaScore' })).toEqual({
      provider: 'thesportsdb,pandascore',
      error: null,
    })
    expect(resolveSportsSourceProviderParam({ category: 'sports' })).toEqual({
      provider: 'thesportsdb',
      error: null,
    })
    expect(resolveSportsSourceProviderParam({ tags: ['Esports'] })).toEqual({
      provider: 'pandascore',
      error: null,
    })
    const configuredProviders = getConfiguredSportsSourceProviders({
      theSportsDbApiKey: '123',
      pandascoreToken: 'panda-token',
    })
    expect(configuredProviders).toEqual(['thesportsdb', 'pandascore'])
    expect(filterSportsSourceProvidersByCategory({
      providers: configuredProviders,
      category: 'sports',
    })).toEqual(['thesportsdb'])
    expect(filterSportsSourceProvidersByCategory({
      providers: configuredProviders,
      category: 'esports',
    })).toEqual(['pandascore'])
  })

  it('only searches providers configured for the selected sports category', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Portugal vs Spain',
      provider: 'thesportsdb',
      auth: { pandascoreToken: 'panda-token' },
      limit: 3,
    })

    expect(candidates).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps esports market suffixes out of parsed matchup names', async () => {
    const { buildSportsSourceMatchupSearchQuery } = await import('@/lib/sports-source/search-query')

    expect(buildSportsSourceMatchupSearchQuery(null, 'Valorant: Team Solid vs 2GAME Esports: Match Winner')).toBe(
      'Team Solid vs 2GAME Esports',
    )
    expect(buildSportsSourceMatchupSearchQuery(null, 'Valorant: Team Solid vs 2GAME Esports (BO3) - VCL Brazil: Playoffs')).toBe(
      'Team Solid vs 2GAME Esports',
    )
  })

  it('uses PandaScore videogame and date browsing before exact match-name search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname === '/valorant/teams' && url.searchParams.get('search[name]') === 'Team Solid') {
        return new Response(JSON.stringify([
          { id: 137098, slug: 'team-solid-valorant', name: 'Team Solid' },
        ]), { status: 200 })
      }
      if (url.pathname === '/valorant/teams' && url.searchParams.get('search[name]') === '2GAME Esports') {
        return new Response(JSON.stringify([
          { id: 134470, slug: '2game-esports', name: '2GAME Esports' },
        ]), { status: 200 })
      }
      if (url.pathname === '/valorant/matches') {
        return new Response(JSON.stringify([
          {
            id: 1488956,
            slug: 'team-solid-2026-07-08',
            name: 'Upper bracket final: TS vs 2GAME',
            begin_at: '2026-07-08T00:01:50Z',
            status: 'not_started',
            league: { id: 4947, name: 'VCL', slug: 'valorant-vcl' },
            serie: { full_name: 'Brazil: Stage 2 2026' },
            tournament: { name: 'Playoffs' },
            videogame: { id: 26, name: 'Valorant', slug: 'valorant' },
            opponents: [
              { opponent: { id: 137098, name: 'Team Solid', acronym: 'TS', slug: 'team-solid-valorant' } },
              { opponent: { id: 134470, name: '2GAME Esports', acronym: '2GAME', slug: '2game-esports' } },
            ],
          },
          {
            id: 1575853,
            slug: 'no-salary-peek-2026-07-08',
            name: 'Lower Bracket Semifinal : NSP vs YJ',
            begin_at: '2026-07-08T08:00:00Z',
            status: 'not_started',
            league: { id: 4947, name: 'VCL', slug: 'valorant-vcl' },
            videogame: { id: 26, name: 'Valorant', slug: 'valorant' },
            opponents: [
              { opponent: { name: 'No Salary Peek', acronym: 'NSP' } },
              { opponent: { name: 'Yi-Jing', acronym: 'YJ' } },
            ],
          },
        ]), { status: 200 })
      }

      return new Response(JSON.stringify([]), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Valorant: Team Solid vs 2GAME Esports (BO3) - VCL Brazil: Playoffs',
      date: '2026-07-08',
      sport: 'valorant',
      provider: 'pandascore',
      auth: { pandascoreToken: 'panda-token' },
      limit: 3,
    })

    const requestUrls = fetchMock.mock.calls.map(call => new URL(String(call[0])))
    const slugUrl = requestUrls.find(url => url.pathname === '/valorant/matches' && url.searchParams.get('filter[slug]') === 'team-solid-2026-07-08')
    const valorantDateUrl = requestUrls.find(url => url.pathname === '/valorant/matches' && url.searchParams.has('range[begin_at]'))
    expect(slugUrl).toBeDefined()
    expect(requestUrls.some(url => url.pathname === '/valorant/teams' && url.searchParams.get('search[name]') === 'Team Solid')).toBe(true)
    expect(requestUrls.some(url => url.pathname === '/valorant/teams' && url.searchParams.get('search[name]') === '2GAME Esports')).toBe(true)
    expect(valorantDateUrl?.searchParams.get('range[begin_at]')).toBe('2026-07-08T00:00:00Z,2026-07-08T23:59:59Z')
    expect(requestUrls.some(url => url.pathname === '/valorant/matches' && url.searchParams.get('search[name]') === 'Valorant: Team Solid vs 2GAME Esports (BO3) - VCL Brazil: Playoffs')).toBe(false)
    expect(candidates[0]?.eventId).toBe('1488956')
    expect(candidates[0]?.homeTeam?.name).toBe('Team Solid')
    expect(candidates[0]?.awayTeam?.name).toBe('2GAME Esports')
  })

  it('keeps PandaScore matches fallback for sport-only searches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname === '/valorant/matches' && !url.searchParams.has('search[name]')) {
        return new Response(JSON.stringify([
          {
            id: 1488956,
            slug: 'team-solid-2026-07-08',
            name: 'Upper bracket final: TS vs 2GAME',
            begin_at: '2026-07-08T00:01:50Z',
            status: 'not_started',
            league: { id: 4947, name: 'VCL', slug: 'valorant-vcl' },
            videogame: { id: 26, name: 'Valorant', slug: 'valorant' },
            opponents: [
              { opponent: { name: 'Team Solid', acronym: 'TS' } },
              { opponent: { name: '2GAME Esports', acronym: '2GAME' } },
            ],
          },
        ]), { status: 200 })
      }

      return new Response(JSON.stringify([]), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: '',
      sport: 'valorant',
      provider: 'pandascore',
      auth: { pandascoreToken: 'panda-token' },
      limit: 3,
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(requestUrl.pathname).toBe('/valorant/matches')
    expect(requestUrl.searchParams.get('per_page')).toBe('3')
    expect(candidates[0]?.eventId).toBe('1488956')
  })

  it('normalizes TheSportsDB matchup punctuation before event search', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      event: [
        {
          idEvent: '2511721',
          idLeague: '4429',
          strLeague: 'FIFA World Cup',
          strSport: 'Soccer',
          strHomeTeam: 'Portugal',
          strAwayTeam: 'Spain',
          strTimestamp: '2026-07-06T19:00:00',
          strStatus: '2H',
        },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Portugal vs. Spain.',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('e=Portugal+vs+Spain')
    expect(candidates[0]?.eventId).toBe('2511721')
    expect(candidates[0]?.live).toBe(true)
  })

  it('cleans prediction-question text before TheSportsDB event search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('e=Arsenal+vs+Chelsea')) {
        return new Response(JSON.stringify({
          event: [
            {
              idEvent: '123',
              idLeague: '4328',
              strLeague: 'Premier League',
              strSport: 'Soccer',
              strHomeTeam: 'Arsenal',
              strAwayTeam: 'Chelsea',
              strTimestamp: '2028-05-01T19:00:00Z',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { suggestSportsEvents } = await import('@/lib/sports-source')
    const candidates = await suggestSportsEvents({
      title: 'Will Arsenal vs. Chelsea end in a draw?',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('e=Arsenal+vs+Chelsea'))).toBe(true)
    expect(candidates[0]?.eventId).toBe('123')
  })

  it('normalizes away-at-home matchup order for TheSportsDB event search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('e=Celtics+vs+Lakers')) {
        return new Response(JSON.stringify({
          event: [
            {
              idEvent: '555',
              idLeague: '4387',
              strLeague: 'NBA',
              strSport: 'Basketball',
              strHomeTeam: 'Celtics',
              strAwayTeam: 'Lakers',
              strTimestamp: '2026-07-06T19:00:00',
              strStatus: 'Game Finished',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Lakers at Celtics',
      sport: 'basketball',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('e=Celtics+vs+Lakers'))).toBe(true)
    expect(candidates[0]?.eventId).toBe('555')
    expect(candidates[0]?.ended).toBe(true)
  })

  it('tries TheSportsDB team aliases for United States matches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('e=USA+vs+Belgium')) {
        return new Response(JSON.stringify({
          event: [
            {
              idEvent: '2507707',
              idLeague: '4429',
              strLeague: 'FIFA World Cup',
              strSport: 'Soccer',
              strHomeTeam: 'USA',
              strAwayTeam: 'Belgium',
              strTimestamp: '2026-07-07T00:00:00',
              strStatus: 'NS',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'United States vs. Belgium',
      date: '2026-07-07',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('e=USA+vs+Belgium'))).toBe(true)
    expect(candidates[0]?.eventId).toBe('2507707')
  })

  it('resolves TheSportsDB live halftime scores by event id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      events: [
        {
          idEvent: '2507707',
          idLeague: '4429',
          strLeague: 'FIFA World Cup',
          strSport: 'Soccer',
          strHomeTeam: 'USA',
          strAwayTeam: 'Belgium',
          intHomeScore: '1',
          intAwayScore: '2',
          strTimestamp: '2026-07-07T00:00:00',
          strStatus: 'HT',
        },
      ],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'thesportsdb',
      eventId: '2507707',
      auth: { theSportsDbApiKey: '123' },
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/lookupevent.php?id=2507707')
    expect(candidate?.score).toBe('1-2')
    expect(candidate?.live).toBe(true)
    expect(candidate?.ended).toBeNull()
  })

  it('uses TheSportsDB filename search with league and date before day fallback', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/searchfilename.php')) {
        return new Response(JSON.stringify({
          event: [
            {
              idEvent: '2511721',
              idLeague: '4429',
              strLeague: 'FIFA World Cup',
              strSport: 'Soccer',
              strHomeTeam: 'Portugal',
              strAwayTeam: 'Spain',
              strTimestamp: '2026-07-06T19:00:00',
              strStatus: '2H',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Portugal vs Spain',
      date: '2026-07-06',
      league: 'fifa-world-cup',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    const filenameUrl = String(fetchMock.mock.calls.at(-1)?.[0])
    expect(filenameUrl).toContain('/searchfilename.php')
    expect(filenameUrl).toContain('e=FIFA+World+Cup+2026-07-06+Portugal+vs+Spain')
    expect(candidates[0]?.eventId).toBe('2511721')
  })

  it('falls back to TheSportsDB eventsday search when event text search returns no matches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/eventsday.php')) {
        return new Response(JSON.stringify({
          events: [
            {
              idEvent: '2397545',
              idLeague: '5076',
              strLeague: 'American USL League One',
              strSport: 'Soccer',
              strHomeTeam: 'AV Alta FC',
              strAwayTeam: 'Charlotte Independence',
              strTimestamp: '2026-07-06T03:00:00',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Charlotte Independence',
      date: '2026-07-06',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/searchevents.php')
    const fallbackUrl = String(fetchMock.mock.calls.at(-1)?.[0])
    expect(fallbackUrl).toContain('/eventsday.php')
    expect(fallbackUrl).toContain('d=2026-07-06')
    expect(fallbackUrl).toContain('s=Soccer')
    expect(candidates[0]?.eventId).toBe('2397545')
  })

  it('continues to TheSportsDB eventsday fallback when filename search fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/searchfilename.php')) {
        return new Response(JSON.stringify({ error: 'temporary failure' }), { status: 500 })
      }
      if (url.includes('/eventsday.php')) {
        return new Response(JSON.stringify({
          events: [
            {
              idEvent: '2397545',
              idLeague: '5076',
              strLeague: 'American USL League One',
              strSport: 'Soccer',
              strHomeTeam: 'AV Alta FC',
              strAwayTeam: 'Charlotte Independence',
              strTimestamp: '2026-07-06T03:00:00',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'AV Alta FC vs Charlotte Independence',
      date: '2026-07-06',
      league: 'american-usl-league-one',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/searchfilename.php'))).toBe(true)
    expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/eventsday.php'))).toBe(true)
    expect(candidates[0]?.eventId).toBe('2397545')
    consoleErrorSpy.mockRestore()
  })

  it('does not return unrelated TheSportsDB day fallback matches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/eventsday.php')) {
        return new Response(JSON.stringify({
          events: [
            {
              idEvent: '999',
              idLeague: '111',
              strLeague: 'Ecuadorian Serie A',
              strSport: 'Soccer',
              strHomeTeam: 'Orense',
              strAwayTeam: 'Técnico Universitario',
              strTimestamp: '2026-07-07T00:00:00',
            },
          ],
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'United States vs Belgium',
      date: '2026-07-07',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(candidates).toEqual([])
  })
})
