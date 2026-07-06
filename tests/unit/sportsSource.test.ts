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
      error: 'Unsupported sports source provider. Use one of: thesportsdb, pandascore, sportmonks.',
    })
    expect(resolveSportsSourceProviderParam({ provider: 'pandascore,legacy', category: 'sports' })).toEqual({
      provider: null,
      error: 'Unsupported sports source provider. Use one of: thesportsdb, pandascore, sportmonks.',
    })
  })

  it('normalizes shared provider rules for sports and esports endpoints', async () => {
    const { resolveSportsSourceProviderParam } = await import('@/lib/sports-source/providers')

    expect(resolveSportsSourceProviderParam({ provider: 'TheSportsDB pandaScore' })).toEqual({
      provider: 'thesportsdb,pandascore',
      error: null,
    })
    expect(resolveSportsSourceProviderParam({ category: 'sports' })).toEqual({
      provider: 'thesportsdb,sportmonks',
      error: null,
    })
    expect(resolveSportsSourceProviderParam({ tags: ['Esports'] })).toEqual({
      provider: 'pandascore',
      error: null,
    })
  })

  it('falls back to TheSportsDB eventsday search when event text search returns no matches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ event: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
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
      }), { status: 200 }))
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
    const fallbackUrl = String(fetchMock.mock.calls[1]?.[0])
    expect(fallbackUrl).toContain('/eventsday.php')
    expect(fallbackUrl).toContain('d=2026-07-06')
    expect(fallbackUrl).toContain('s=Soccer')
    expect(candidates[0]?.eventId).toBe('2397545')
  })

  it('does not promote non-watchable Sportmonks TV station pages as livestreams', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: {
        id: 99,
        league_id: 8,
        starting_at: '2028-05-01T19:00:00Z',
        league: { id: 8, name: 'Premier League' },
        participants: [
          { name: 'Arsenal', short_code: 'ARS', meta: { location: 'home' } },
          { name: 'Chelsea', short_code: 'CHE', meta: { location: 'away' } },
        ],
        state: { name: 'Not Started' },
        tvstations: [{ url: 'https://www.espn.com' }],
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { resolveSportsEvent } = await import('@/lib/sports-source')
    const candidate = await resolveSportsEvent({
      provider: 'sportmonks',
      eventId: '99',
      auth: { sportmonksApiToken: 'admin-sportmonks-key' },
    })

    expect(candidate?.livestreamUrl).toBeNull()
    expect(candidate?.livestreamProvider).toBeNull()
  })
})
