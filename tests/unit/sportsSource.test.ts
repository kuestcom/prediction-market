import { beforeEach, describe, expect, it, vi } from 'vitest'

function getRequestUrl(input: unknown) {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input instanceof Request ? input.url : ''
}

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
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Arsenal vs Chelsea',
      outcomes: ['Arsenal', 'Chelsea'],
      auth: { theSportsDbApiKey: 'admin-tsdb-key' },
      limit: 3,
    })

    const requestUrl = getRequestUrl(fetchMock.mock.calls[0]?.[0])
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
    expect(
      filterSportsSourceProvidersByCategory({
        providers: configuredProviders,
        category: 'sports',
      }),
    ).toEqual(['thesportsdb'])
    expect(
      filterSportsSourceProvidersByCategory({
        providers: configuredProviders,
        category: 'esports',
      }),
    ).toEqual(['pandascore'])
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
    expect(
      buildSportsSourceMatchupSearchQuery(null, 'Valorant: Team Solid vs 2GAME Esports (BO3) - VCL Brazil: Playoffs'),
    ).toBe('Team Solid vs 2GAME Esports')
  })

  it('uses one PandaScore videogame and date request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === '/valorant/teams' && url.searchParams.get('search[name]') === 'Team Solid') {
        return new Response(JSON.stringify([{ id: 137098, slug: 'team-solid-valorant', name: 'Team Solid' }]), {
          status: 200,
        })
      }
      if (url.pathname === '/valorant/teams' && url.searchParams.get('search[name]') === '2GAME Esports') {
        return new Response(JSON.stringify([{ id: 134470, slug: '2game-esports', name: '2GAME Esports' }]), {
          status: 200,
        })
      }
      if (url.pathname === '/valorant/matches') {
        return new Response(
          JSON.stringify([
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
          ]),
          { status: 200 },
        )
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

    const requestUrls = fetchMock.mock.calls.map((call) => new URL(getRequestUrl(call[0])))
    const valorantDateUrl = requestUrls[0]
    expect(requestUrls).toHaveLength(1)
    expect(valorantDateUrl?.pathname).toBe('/valorant/matches')
    expect(valorantDateUrl?.searchParams.get('per_page')).toBe('100')
    expect(valorantDateUrl?.searchParams.get('range[begin_at]')).toBe('2026-07-08T00:00:00Z,2026-07-08T23:59:59Z')
    expect(valorantDateUrl?.searchParams.has('search[name]')).toBe(false)
    expect(candidates[0]?.eventId).toBe('1488956')
    expect(candidates[0]?.homeTeam?.name).toBe('Team Solid')
    expect(candidates[0]?.awayTeam?.name).toBe('2GAME Esports')
  })

  it('loads PandaScore map results for a resolved match', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === '/matches/7001') {
        return new Response(
          JSON.stringify({
            id: 7001,
            status: 'running',
            number_of_games: 3,
            videogame: { slug: 'cs-go' },
            opponents: [{ opponent: { id: 11, name: 'Alpha' } }, { opponent: { id: 22, name: 'Beta' } }],
          }),
          { status: 200 },
        )
      }
      if (url.pathname === '/csgo/matches/7001/games') {
        return new Response(
          JSON.stringify([
            {
              position: 1,
              results: [
                { team_id: 22, score: 9 },
                { team_id: 11, score: 13 },
              ],
            },
          ]),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({}), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'pandascore',
      eventId: '7001',
      auth: { pandascoreToken: 'panda-token' },
    })

    expect(candidate?.segmentScores).toEqual([{ segment: 1, homeScore: 13, awayScore: 9 }])
    expect(candidate?.segmentCount).toBe(3)
  })

  it('does not request PandaScore map results before a match starts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === '/matches/7002') {
        return new Response(
          JSON.stringify({
            id: 7002,
            status: 'not_started',
            begin_at: '2099-08-07T12:00:00Z',
            videogame: { slug: 'cs-go' },
            opponents: [{ opponent: { id: 11, name: 'Alpha' } }, { opponent: { id: 22, name: 'Beta' } }],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({}), { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'pandascore',
      eventId: '7002',
      auth: { pandascoreToken: 'panda-token' },
    })

    expect(candidate?.segmentScores).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps map results returned by the match when the supplemental request fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === '/matches/7003') {
        return new Response(
          JSON.stringify({
            id: 7003,
            status: 'running',
            videogame: { slug: 'cs-go' },
            opponents: [{ opponent: { id: 11, name: 'Alpha' } }, { opponent: { id: 22, name: 'Beta' } }],
            games: [
              {
                position: 1,
                results: [
                  { team_id: 11, score: 13 },
                  { team_id: 22, score: 9 },
                ],
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({}), { status: 503 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'pandascore',
      eventId: '7003',
      auth: { pandascoreToken: 'panda-token' },
    })

    expect(candidate?.segmentScores).toEqual([{ segment: 1, homeScore: 13, awayScore: 9 }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['counter', 'csgo', 'cs-go'],
    ['overwatch', 'ow', 'overwatch'],
    ['rainbow', 'r6siege', 'rainbow-six-siege'],
    ['valorant', 'valorant', 'valorant'],
    ['call', 'codmw', 'call-of-duty'],
    ['call-of-duty', 'codmw', 'call-of-duty'],
    ['honor', 'kog', 'honor-of-kings'],
    ['honor-of-kings', 'kog', 'honor-of-kings'],
    ['league', 'lol', 'league-of-legends'],
    ['league-of-legends', 'lol', 'league-of-legends'],
    ['dota', 'dota2', 'dota-2'],
    ['dota-2', 'dota2', 'dota-2'],
  ])('maps PandaScore sport alias %s to one /%s/matches request', async (sport, endpoint, providerSportSlug) => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify([
            {
              id: 7001,
              name: 'Alpha vs Beta',
              begin_at: '2026-07-11T12:00:00Z',
              status: 'not_started',
              league: { id: 1, name: 'Test League', slug: 'test-league' },
              videogame: { id: 1, name: providerSportSlug, slug: providerSportSlug },
              opponents: [{ opponent: { id: 1, name: 'Alpha' } }, { opponent: { id: 2, name: 'Beta' } }],
            },
          ]),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Alpha vs Beta',
      teams: [{ name: 'Alpha' }, { name: 'Beta' }],
      date: '2026-07-11',
      sport,
      category: 'esports',
      provider: 'pandascore',
      auth: { pandascoreToken: 'panda-token' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(getRequestUrl(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe(`/${endpoint}/matches`)
    expect(candidates[0]?.eventId).toBe('7001')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('maps the counter sport slug to PandaScore CS2 matches and ignores generic market outcomes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === '/csgo/teams') {
        const teamName = url.searchParams.get('search[name]')
        return new Response(JSON.stringify([{ id: teamName === 'Tricksters' ? 3274452 : 3280996, name: teamName }]), {
          status: 200,
        })
      }
      if (url.pathname === '/csgo/matches') {
        return new Response(
          JSON.stringify([
            {
              id: 1575327,
              name: 'Lower bracket semifinal: Tricksters vs TheBoys',
              begin_at: '2026-07-11T18:20:12Z',
              status: 'not_started',
              league: { id: 10310, name: 'CCT Europe', slug: 'cct-europe-contenders' },
              videogame: { id: 3, name: 'Counter-Strike 2', slug: 'cs-go' },
              opponents: [
                { opponent: { id: 3274452, name: 'Tricksters' } },
                { opponent: { id: 3280996, name: 'TheBoys' } },
              ],
            },
          ]),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify([]), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Counter-Strike: Tricksters vs TheBoys (BO3) - CCT Europe Contenders #6 Playoffs',
      question: 'Games Total: O/U 2.5',
      outcomes: ['Over', 'Under'],
      tags: ['Sports', 'Esports', 'counter strike 2'],
      category: 'esports',
      date: '2026-07-11',
      sport: 'counter',
      provider: 'pandascore',
      auth: { pandascoreToken: 'panda-token' },
      limit: 5,
    })

    const requestUrls = fetchMock.mock.calls.map((call) => new URL(getRequestUrl(call[0])))
    expect(requestUrls).toHaveLength(1)
    expect(requestUrls[0]?.pathname).toBe('/csgo/matches')
    expect(requestUrls[0]?.searchParams.get('range[begin_at]')).toBe('2026-07-11T00:00:00Z,2026-07-11T23:59:59Z')
    expect(candidates[0]?.eventId).toBe('1575327')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('keeps PandaScore matches fallback for sport-only searches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === '/valorant/matches' && !url.searchParams.has('search[name]')) {
        return new Response(
          JSON.stringify([
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
          ]),
          { status: 200 },
        )
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

    const requestUrl = new URL(getRequestUrl(fetchMock.mock.calls[0]?.[0]))
    expect(requestUrl.pathname).toBe('/valorant/matches')
    expect(requestUrl.searchParams.get('per_page')).toBe('3')
    expect(candidates[0]?.eventId).toBe('1488956')
  })

  it.each([
    {
      label: 'League of Legends',
      endpoint: 'lol',
      sport: 'league-of-legends',
      eventId: 1541779,
      title: 'Hanwha Life Esports vs LYON',
      home: 'Hanwha Life Esports',
      away: 'LYON',
      videogame: { id: 1, name: 'LoL', slug: 'league-of-legends' },
    },
    {
      label: 'Dota 2',
      endpoint: 'dota2',
      sport: 'dota-2',
      eventId: 1565607,
      title: 'BetBoom Team vs GamerLegion',
      home: 'BetBoom Team',
      away: 'GamerLegion',
      videogame: { id: 4, name: 'Dota 2', slug: 'dota-2' },
    },
  ])('matches structured $label moneyline opponents', async (sample) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname === `/${sample.endpoint}/teams`) {
        const teamName = url.searchParams.get('search[name]')
        return new Response(JSON.stringify([{ id: teamName === sample.home ? 1 : 2, name: teamName }]), { status: 200 })
      }
      if (url.pathname === `/${sample.endpoint}/matches`) {
        return new Response(
          JSON.stringify([
            {
              id: sample.eventId,
              name: sample.title,
              begin_at: '2026-07-11T09:02:35Z',
              status: 'not_started',
              league: { id: 5404, name: 'Esports World Cup', slug: `${sample.endpoint}-esports-world-cup` },
              videogame: sample.videogame,
              opponents: [{ opponent: { id: 1, name: sample.home } }, { opponent: { id: 2, name: sample.away } }],
            },
          ]),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify([]), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: sample.title,
      teams: [{ name: sample.home }, { name: sample.away }],
      outcomes: ['Yes', 'No'],
      category: 'esports',
      date: '2026-07-11',
      sport: sample.sport,
      provider: 'pandascore',
      auth: { pandascoreToken: 'panda-token' },
      limit: 5,
    })

    expect(
      fetchMock.mock.calls.some((call) => new URL(getRequestUrl(call[0])).pathname === `/${sample.endpoint}/matches`),
    ).toBe(true)
    expect(candidates[0]?.eventId).toBe(String(sample.eventId))
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('normalizes TheSportsDB matchup punctuation before event search', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Portugal vs. Spain.',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('e=Portugal+vs+Spain')
    expect(candidates[0]?.eventId).toBe('2511721')
    expect(candidates[0]?.live).toBe(true)
  })

  it.each([
    ['soccer', 'Soccer'],
    ['fifa', 'Soccer'],
    ['bkbbl', 'Basketball'],
    ['nba', 'Basketball'],
    ['wnba', 'Basketball'],
    ['cba', 'Basketball'],
    ['ncaa-cbb', 'Basketball'],
    ['kbo', 'Baseball'],
    ['mlb', 'Baseball'],
    ['npb', 'Baseball'],
    ['cfl', 'American Football'],
    ['cricket', 'Cricket'],
    ['international-cricket', 'Cricket'],
    ['atp', 'Tennis'],
    ['itf', 'Tennis'],
    ['wimbledon', 'Tennis'],
    ['wta', 'Tennis'],
    ['pga-tour', 'Golf'],
    ['power-slap', 'Fighting'],
    ['ufc', 'Fighting'],
  ])('matches TheSportsDB sport alias %s as %s', async (sport, providerSport) => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            events: [
              {
                idEvent: '8001',
                idLeague: '100',
                strLeague: 'Test League',
                strSport: providerSport,
                strEvent: 'Alpha vs Beta',
                strHomeTeam: 'Alpha',
                strAwayTeam: 'Beta',
                strTimestamp: '2026-07-11T12:00:00',
              },
            ],
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Alpha vs Beta',
      teams: [{ name: 'Alpha' }, { name: 'Beta' }],
      date: '2026-07-11',
      sport,
      category: 'sports',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(getRequestUrl(fetchMock.mock.calls[0]?.[0]))
    if (providerSport === 'Fighting') {
      expect(url.pathname).toContain('/eventsday.php')
      expect(url.searchParams.get('s')).toBe(providerSport)
    } else {
      expect(url.pathname).toContain('/searchevents.php')
    }
    expect(candidates[0]?.eventId).toBe('8001')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('cleans prediction-question text before TheSportsDB event search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('e=Arsenal+vs+Chelsea')) {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: '123',
                idLeague: '4328',
                strLeague: 'Premier League',
                strSport: 'Soccer',
                strEvent: 'Arsenal vs Chelsea',
                strHomeTeam: 'Arsenal',
                strAwayTeam: 'Chelsea',
                strTimestamp: '2028-05-01T19:00:00Z',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Will Arsenal vs. Chelsea end in a draw?',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('e=Arsenal+vs+Chelsea')
    expect(candidates[0]?.eventId).toBe('123')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('prefers matchup teams from the event title over yes/no outcomes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/searchevents.php')) {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: '2528031',
                idLeague: '4429',
                strLeague: 'FIFA World Cup',
                strSport: 'Soccer',
                strEvent: 'France vs Spain',
                strHomeTeam: 'France',
                strAwayTeam: 'Spain',
                strTimestamp: '2026-07-14T19:00:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'France vs. Spain',
      question: 'Will Spain win on 2026-07-14?',
      outcomes: ['Yes', 'No'],
      date: '2026-07-14',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('/searchevents.php?e=France+vs+Spain')
    expect(candidates[0]?.eventId).toBe('2528031')
    expect(candidates[0]?.startTime).toBe('2026-07-14T19:00:00.000Z')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('normalizes away-at-home matchup order for TheSportsDB event search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('e=Celtics+vs+Lakers')) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        )
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

    expect(fetchMock.mock.calls.some((call) => getRequestUrl(call[0]).includes('e=Celtics+vs+Lakers'))).toBe(true)
    expect(candidates[0]?.eventId).toBe('555')
    expect(candidates[0]?.ended).toBe(true)
  })

  it('tries the reversed order for an already simplified TheSportsDB matchup', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('e=Beta+vs+Alpha')) {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: 'reverse-1',
                idLeague: '4328',
                strLeague: 'English Premier League',
                strSport: 'Soccer',
                strHomeTeam: 'Beta',
                strAwayTeam: 'Alpha',
                strTimestamp: '2026-08-01T19:00:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Alpha vs Beta',
      date: '2026-08-01',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 3,
    })

    const searchQueries = fetchMock.mock.calls
      .map((call) => new URL(getRequestUrl(call[0])).searchParams.get('e'))
      .filter((query): query is string => Boolean(query))

    expect(searchQueries).toEqual(['Alpha vs Beta', 'Beta vs Alpha'])
    expect(candidates[0]?.eventId).toBe('reverse-1')
  })

  it('tries TheSportsDB team aliases for United States matches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/searchevents.php')) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        )
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('/searchevents.php?e=USA+vs+Belgium')
    expect(candidates[0]?.eventId).toBe('2507707')
  })

  it('retries TheSportsDB football matchups with canonical club names and accepts the adjacent UTC date', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname.endsWith('/searchevents.php') && url.searchParams.get('e') === 'Cruzeiro vs Flamengo') {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: '2478532',
                idLeague: '4481',
                strLeague: 'Copa Libertadores',
                strSport: 'Soccer',
                strEvent: 'Cruzeiro vs Flamengo',
                strHomeTeam: 'Cruzeiro',
                strAwayTeam: 'Flamengo',
                dateEvent: '2026-08-13',
                strTimestamp: '2026-08-13T00:30:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Cruzeiro EC vs. CR Flamengo',
      teams: [{ name: 'Cruzeiro EC' }, { name: 'CR Flamengo' }],
      date: '2026-08-12',
      sport: 'lib',
      series: 'lib-2025',
      category: 'sports',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    const urls = fetchMock.mock.calls.map((call) => new URL(getRequestUrl(call[0])))
    expect(urls.some((url) => url.searchParams.get('e') === 'Cruzeiro vs Flamengo')).toBe(true)
    expect(candidates[0]?.eventId).toBe('2478532')
    expect(candidates[0]?.eventDate).toBe('2026-08-13')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('normalizes provider-specific football team aliases before retrying TheSportsDB', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname.endsWith('/searchevents.php') && url.searchParams.get('e') === 'Toulouse vs Real Sociedad') {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: '2521691',
                idLeague: '4914',
                strLeague: 'Club Friendlies',
                strSport: 'Soccer',
                strEvent: 'Toulouse vs Real Sociedad',
                strHomeTeam: 'Toulouse',
                strAwayTeam: 'Real Sociedad',
                dateEvent: '2026-07-31',
                strTimestamp: '2026-07-31T17:00:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Toulouse FC vs. Real Sociedad San Sebastian',
      teams: [{ name: 'Toulouse FC' }, { name: 'Real Sociedad San Sebastian' }],
      date: '2026-07-31',
      sport: 'clf',
      series: 'clf-games',
      category: 'sports',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    expect(
      fetchMock.mock.calls.some(
        (call) => new URL(getRequestUrl(call[0])).searchParams.get('e') === 'Toulouse vs Real Sociedad',
      ),
    ).toBe(true)
    expect(candidates[0]?.eventId).toBe('2521691')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('uses TheSportsDB team search as a canonical-name fallback', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname.endsWith('/searchteams.php')) {
        const query = url.searchParams.get('t')
        return new Response(
          JSON.stringify({
            teams:
              query === 'Paris Saint-Germain'
                ? [
                    {
                      strTeam: 'Paris SG',
                      strTeamAlternate: 'Paris Saint-Germain, PSG',
                      strSport: 'Soccer',
                    },
                  ]
                : [
                    {
                      strTeam: 'Manchester United',
                      strTeamAlternate: 'Manchester United FC, Man United',
                      strSport: 'Soccer',
                    },
                  ],
          }),
          { status: 200 },
        )
      }
      if (url.pathname.endsWith('/searchevents.php') && url.searchParams.get('e') === 'Paris SG vs Manchester United') {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: 'canonical-1',
                idLeague: '100',
                strLeague: 'Test League',
                strSport: 'Soccer',
                strEvent: 'Paris SG vs Manchester United',
                strHomeTeam: 'Paris SG',
                strAwayTeam: 'Manchester United',
                dateEvent: '2026-08-10',
                strTimestamp: '2026-08-10T19:00:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { searchSportsEvents } = await import('@/lib/sports-source')
    const candidates = await searchSportsEvents({
      q: 'Paris Saint-Germain FC vs Manchester United FC',
      date: '2026-08-10',
      sport: 'soccer',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    expect(
      fetchMock.mock.calls.some((call) => new URL(getRequestUrl(call[0])).pathname.endsWith('/searchteams.php')),
    ).toBe(true)
    expect(candidates[0]?.eventId).toBe('canonical-1')
  })

  it.each([
    {
      title: "UFC Fight Night: Stephanie Luciano vs. Marina Spasic (Women's Strawweight, Prelims)",
      teams: [{ name: 'Stephanie Luciano' }, { name: 'Marina Spasić' }],
    },
    {
      title: 'UFC Fight Night: Alexander Poppeck vs. Jovan Leka (Heavyweight, Prelims)',
      teams: [{ name: 'Alexander Poppeck' }, { name: 'Jovan Leka' }],
    },
  ])('matches UFC undercard fight $title to the dated parent card', async ({ title, teams }) => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            events: [
              {
                idEvent: '2476379',
                idLeague: '4443',
                strLeague: 'UFC',
                strSport: 'Fighting',
                strEvent: 'UFC Fight Night 283 Medić vs Rodriguez',
                strHomeTeam: null,
                strAwayTeam: null,
                dateEvent: '2026-08-01',
                strTimestamp: '2026-08-01T14:00:00',
              },
            ],
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title,
      teams,
      date: '2026-08-01',
      sport: 'ufc',
      series: 'ufc',
      category: 'sports',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(candidates[0]?.eventId).toBe('2476379')
    expect(candidates[0]?.matchReason).toContain('series')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('resolves TheSportsDB live halftime scores by event id', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'thesportsdb',
      eventId: '2507707',
      auth: { theSportsDbApiKey: '123' },
    })

    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('/lookupevent.php?id=2507707')
    expect(candidate?.score).toBe('1-2')
    expect(candidate?.live).toBe(true)
    expect(candidate?.ended).toBeNull()
  })

  it('marks finished TheSportsDB events as no longer live', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            events: [
              {
                idEvent: '2507707',
                idLeague: '4429',
                strLeague: 'FIFA World Cup',
                strSport: 'Soccer',
                strHomeTeam: 'USA',
                strAwayTeam: 'Belgium',
                intHomeScore: '1',
                intAwayScore: '4',
                strTimestamp: '2026-07-07T00:00:00',
                strStatus: 'FT',
              },
            ],
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'thesportsdb',
      eventId: '2507707',
      auth: { theSportsDbApiKey: '123' },
    })

    expect(candidate?.live).toBe(false)
    expect(candidate?.ended).toBe(true)
  })

  it('uses one TheSportsDB filename request when league and date are provided', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/searchfilename.php')) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        )
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const filenameUrl = getRequestUrl(fetchMock.mock.calls[0]?.[0])
    expect(filenameUrl).toContain('/searchfilename.php')
    expect(filenameUrl).toContain('e=FIFA+World+Cup+2026-07-06+Portugal+vs+Spain')
    expect(candidates[0]?.eventId).toBe('2511721')
  })

  it.each([
    ['cfl', 'American Football'],
    ['ufc', 'Fighting'],
    ['wnba', 'Basketball'],
  ])('uses one TheSportsDB day request for the %s series', async (series, providerSport) => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            events: [
              {
                idEvent: '9001',
                idLeague: '100',
                strLeague: series.toUpperCase(),
                strSport: providerSport,
                strEvent: 'Alpha vs Beta',
                strHomeTeam: 'Alpha',
                strAwayTeam: 'Beta',
                strTimestamp: '2026-07-11T12:00:00',
              },
            ],
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Alpha vs Beta',
      teams: [{ name: 'Alpha' }, { name: 'Beta' }],
      date: '2026-07-11',
      sport: series,
      series,
      category: 'sports',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(getRequestUrl(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toContain('/eventsday.php')
    expect(url.searchParams.get('d')).toBe('2026-07-11')
    expect(url.searchParams.get('s')).toBe(providerSport)
    expect(candidates[0]?.eventId).toBe('9001')
  })

  it('falls back from TheSportsDB filename search to the generic event search', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/searchevents.php')) {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: '9002',
                idLeague: '100',
                strLeague: 'Braunschweig',
                strSport: 'Tennis',
                strEvent: 'Alpha vs Beta',
                strHomeTeam: 'Alpha',
                strAwayTeam: 'Beta',
                strTimestamp: '2026-07-11T12:00:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Alpha vs Beta',
      teams: [{ name: 'Alpha' }, { name: 'Beta' }],
      date: '2026-07-11',
      sport: 'atp',
      league: 'Braunschweig',
      series: 'atp',
      category: 'sports',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('/searchfilename.php')
    expect(getRequestUrl(fetchMock.mock.calls[1]?.[0])).toContain('/searchevents.php?e=Alpha+vs+Beta')
    expect(candidates[0]?.eventId).toBe('9002')
  })

  it('falls back to TheSportsDB eventsday when primary search has no dated match', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/eventsday.php')) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        )
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

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getRequestUrl(fetchMock.mock.calls[0]?.[0])).toContain('/searchevents.php')
    const dayUrl = getRequestUrl(fetchMock.mock.calls[1]?.[0])
    expect(dayUrl).toContain('/eventsday.php')
    expect(dayUrl).toContain('d=2026-07-06')
    expect(dayUrl).toContain('s=Soccer')
    expect(candidates[0]?.eventId).toBe('2397545')
  })

  it('keeps other dates out of the primary TheSportsDB request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/searchevents.php')) {
        return new Response(
          JSON.stringify({
            event: [
              {
                idEvent: '2449206',
                idLeague: '4516',
                strLeague: 'WNBA',
                strSport: 'Basketball',
                strEvent: 'Minnesota Lynx vs New York Liberty',
                strHomeTeam: 'Minnesota Lynx',
                strAwayTeam: 'New York Liberty',
                strTimestamp: '2026-09-18T23:30:00',
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/eventsday.php')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                idEvent: '2449103',
                idLeague: '4516',
                strLeague: 'WNBA',
                strSport: 'Basketball',
                strEvent: 'Minnesota Lynx vs New York Liberty',
                strHomeTeam: 'Minnesota Lynx',
                strAwayTeam: 'New York Liberty',
                strTimestamp: '2026-07-11T17:00:00',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'Minnesota Lynx vs New York Liberty',
      teams: [{ name: 'Minnesota Lynx' }, { name: 'New York Liberty' }],
      outcomes: ['Yes', 'No'],
      date: '2026-07-11',
      sport: 'basketball',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    expect(candidates[0]?.eventId).toBe('2449103')
    expect(candidates[0]?.confidence).toBe(1)
    expect(candidates).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(
      fetchMock.mock.calls.some((call) => getRequestUrl(call[0]).includes('e=New+York+Liberty+vs+Minnesota+Lynx')),
    ).toBe(true)
  })

  it('matches UFC events whose TheSportsDB payload only provides an event name', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(getRequestUrl(input))
      if (url.pathname.endsWith('/eventsday.php')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                idEvent: '2468285',
                idLeague: '4443',
                strLeague: 'UFC',
                strSport: 'Fighting',
                strEvent: 'UFC 329 McGregor vs Holloway 2',
                strHomeTeam: null,
                strAwayTeam: null,
                strTimestamp: '2026-07-11T21:00:00',
                dateEvent: '2026-07-11',
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ event: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { findSportsEvents } = await import('@/lib/sports-source')
    const candidates = await findSportsEvents({
      title: 'UFC 329: Max Holloway vs. Conor McGregor (Welterweight, Main Card)',
      question: 'O/U 4.5 Rounds',
      outcomes: ['Over', 'Under'],
      tags: ['Sports', 'UFC', 'UFC 329'],
      date: '2026-07-11',
      sport: 'ufc',
      provider: 'thesportsdb',
      auth: { theSportsDbApiKey: '123' },
      limit: 5,
    })

    const fallbackUrl = new URL(getRequestUrl(fetchMock.mock.calls.at(-1)?.[0]))
    expect(fallbackUrl.pathname).toContain('/eventsday.php')
    expect(fallbackUrl.searchParams.get('s')).toBe('Fighting')
    expect(candidates[0]?.eventId).toBe('2468285')
    expect(candidates[0]?.eventName).toBe('UFC 329 McGregor vs Holloway 2')
    expect(candidates[0]?.startTime).toBe('2026-07-11T21:00:00.000Z')
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })

  it('does not return unrelated TheSportsDB day fallback matches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input)
      if (url.includes('/eventsday.php')) {
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        )
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
