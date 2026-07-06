import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  isCronAuthorized: vi.fn(),
  loadAllowedMarketCreatorWallets: vi.fn(),
  loadAutoDeployNewEventsEnabled: vi.fn(),
  refreshAllowedMarketCreatorSiteSources: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth-cron', () => ({
  isCronAuthorized: (...args: any[]) => mocks.isCronAuthorized(...args),
}))

vi.mock('@/lib/allowed-market-creators-server', () => ({
  loadAllowedMarketCreatorWallets: (...args: any[]) => mocks.loadAllowedMarketCreatorWallets(...args),
  refreshAllowedMarketCreatorSiteSources: (...args: any[]) => mocks.refreshAllowedMarketCreatorSiteSources(...args),
}))

vi.mock('@/lib/db/utils/run-query', () => ({
  runQuery: async (callback: () => Promise<unknown>) => await callback(),
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    select: (...args: any[]) => mocks.select(...args),
    update: (...args: any[]) => mocks.update(...args),
  },
}))

vi.mock('@/lib/event-sync-settings', () => ({
  loadAutoDeployNewEventsEnabled: (...args: any[]) => mocks.loadAutoDeployNewEventsEnabled(...args),
}))

function makeSelectChain(result: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => result,
      }),
    }),
  }
}

function makeUpdateChain(result: Array<{ id: string }>) {
  return {
    set: () => ({
      where: () => ({
        returning: async () => result,
      }),
    }),
  }
}

describe('sync events route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', mocks.fetch)

    mocks.fetch.mockReset()
    mocks.isCronAuthorized.mockReset()
    mocks.loadAllowedMarketCreatorWallets.mockReset()
    mocks.loadAutoDeployNewEventsEnabled.mockReset()
    mocks.refreshAllowedMarketCreatorSiteSources.mockReset()
    mocks.select.mockReset()
    mocks.update.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps an incoming additional context timestamp when only the timestamp field is present', async () => {
    const { resolveAdditionalContextUpdatedAtIso } = await import('@/app/api/sync/events/route')

    expect(resolveAdditionalContextUpdatedAtIso({
      hasAdditionalContextField: false,
      hasAdditionalContextTimeField: true,
      additionalContext: null,
      additionalContextUpdatedAtIso: '2026-08-25T12:00:00.000Z',
      existingAdditionalContextUpdatedAtIso: '2026-08-24T12:00:00.000Z',
    })).toBe('2026-08-25T12:00:00.000Z')
  })

  it('reuses sports source payload when partial incoming identity resolves to the same source', async () => {
    const { mergeSportsSourceFieldsWithExisting } = await import('@/app/api/sync/events/route')

    expect(mergeSportsSourceFieldsWithExisting({
      current: {
        provider: 'thesportsdb',
        eventId: null,
        gameId: null,
        leagueId: null,
        leagueLabel: null,
        matchConfidence: null,
        payload: null,
      },
      existing: {
        sports_source_provider: 'thesportsdb',
        sports_source_event_id: '123',
        sports_source_game_id: null,
        sports_source_league_id: '4328',
        sports_source_league_label: 'Premier League',
        sports_source_match_confidence: '0.8700',
        sports_source_payload: { provider: 'thesportsdb', eventId: '123' },
      },
    })).toEqual({
      provider: 'thesportsdb',
      eventId: '123',
      gameId: null,
      leagueId: '4328',
      leagueLabel: 'Premier League',
      matchConfidence: '0.8700',
      payload: { provider: 'thesportsdb', eventId: '123' },
    })
  })

  it('clears stale sports source details when incoming identity changes', async () => {
    const { mergeSportsSourceFieldsWithExisting } = await import('@/app/api/sync/events/route')

    expect(mergeSportsSourceFieldsWithExisting({
      current: {
        provider: 'thesportsdb',
        eventId: '456',
        gameId: null,
        leagueId: null,
        leagueLabel: null,
        matchConfidence: null,
        payload: null,
      },
      existing: {
        sports_source_provider: 'thesportsdb',
        sports_source_event_id: '123',
        sports_source_game_id: null,
        sports_source_league_id: '4328',
        sports_source_league_label: 'Premier League',
        sports_source_match_confidence: '0.8700',
        sports_source_payload: { provider: 'thesportsdb', eventId: '123' },
      },
    })).toEqual({
      provider: 'thesportsdb',
      eventId: '456',
      gameId: null,
      leagueId: null,
      leagueLabel: null,
      matchConfidence: null,
      payload: null,
    })
  })

  it('does not merge old sports source ids into a provider switch', async () => {
    const { mergeSportsSourceFieldsWithExisting } = await import('@/app/api/sync/events/route')

    expect(mergeSportsSourceFieldsWithExisting({
      current: {
        provider: 'pandascore',
        eventId: null,
        gameId: null,
        leagueId: null,
        leagueLabel: null,
        matchConfidence: null,
        payload: null,
      },
      existing: {
        sports_source_provider: 'thesportsdb',
        sports_source_event_id: '123',
        sports_source_game_id: '999',
        sports_source_league_id: '4328',
        sports_source_league_label: 'Premier League',
        sports_source_match_confidence: '0.8700',
        sports_source_payload: { provider: 'thesportsdb', eventId: '123' },
      },
    })).toEqual({
      provider: 'pandascore',
      eventId: null,
      gameId: null,
      leagueId: null,
      leagueLabel: null,
      matchConfidence: null,
      payload: null,
    })
  })

  it('does not reuse legacy sports source providers or ids', async () => {
    const { mergeSportsSourceFieldsWithExisting } = await import('@/app/api/sync/events/route')

    expect(mergeSportsSourceFieldsWithExisting({
      current: {
        provider: null,
        eventId: null,
        gameId: null,
        leagueId: null,
        leagueLabel: null,
        matchConfidence: null,
        payload: null,
      },
      existing: {
        sports_source_provider: 'legacy',
        sports_source_event_id: '123',
        sports_source_game_id: '999',
        sports_source_league_id: 'old-league',
        sports_source_league_label: 'Old League',
        sports_source_match_confidence: '0.5000',
        sports_source_payload: { provider: 'legacy', eventId: '123' },
      },
    })).toEqual({
      provider: null,
      eventId: null,
      gameId: null,
      leagueId: null,
      leagueLabel: null,
      matchConfidence: null,
      payload: null,
    })
  })

  it('includes null event sports source fields when any source field is updated', async () => {
    const { buildEventSportsSourceUpsertPayload } = await import('@/app/api/sync/events/route')
    const selectedAt = new Date('2026-07-06T12:00:00.000Z')

    expect(buildEventSportsSourceUpsertPayload({
      sports_source_provider: 'thesportsdb',
      sports_source_event_id: '456',
      sports_source_game_id: null,
      sports_source_league_id: null,
      sports_source_league_label: null,
      sports_source_match_confidence: null,
      sports_source_payload: null,
      sports_source_selected_at: selectedAt,
    })).toEqual({
      sports_source_provider: 'thesportsdb',
      sports_source_event_id: '456',
      sports_source_game_id: null,
      sports_source_league_id: null,
      sports_source_league_label: null,
      sports_source_match_confidence: null,
      sports_source_payload: null,
      sports_source_selected_at: selectedAt,
    })
  })

  it('includes null market sports source fields when any source field is updated', async () => {
    const { buildMarketSportsSourceUpsertPayload } = await import('@/app/api/sync/events/route')

    expect(buildMarketSportsSourceUpsertPayload({
      sports_source_provider: 'pandascore',
      sports_source_event_id: null,
      sports_source_game_id: null,
      sports_source_league_id: null,
      sports_source_league_label: null,
      sports_source_market_id: null,
      sports_source_match_confidence: null,
      sports_source_payload: null,
    })).toEqual({
      sports_source_provider: 'pandascore',
      sports_source_event_id: null,
      sports_source_game_id: null,
      sports_source_league_id: null,
      sports_source_league_label: null,
      sports_source_market_id: null,
      sports_source_match_confidence: null,
      sports_source_payload: null,
    })
  })

  it('hits the PnL subgraph and exits cleanly when no markets are returned', async () => {
    mocks.isCronAuthorized.mockReturnValue(true)
    mocks.loadAllowedMarketCreatorWallets.mockResolvedValue({
      data: ['0xABCDEF0000000000000000000000000000000001'],
      error: null,
    })
    mocks.loadAutoDeployNewEventsEnabled.mockResolvedValue(false)
    mocks.refreshAllowedMarketCreatorSiteSources.mockResolvedValue({
      scanned: 0,
      checked: 0,
      refreshed: 0,
      skippedFresh: 0,
      wallets: 0,
      errors: [],
    })
    mocks.select.mockImplementation(() => makeSelectChain([]))
    mocks.update.mockImplementation(() => makeUpdateChain([{ id: 'sync-row' }]))
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          conditions: [],
        },
      }),
    })

    const { GET } = await import('@/app/api/sync/events/route')
    const response = await GET(new Request('https://example.com/api/sync/events', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'No new markets to process',
      processed: 0,
      fetched: 0,
    })

    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://subgraphs.kuest.com/pnl-subgraph',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      }),
    )

    const requestBody = JSON.parse(String(mocks.fetch.mock.calls[0][1].body))
    expect(requestBody.variables.creators).toEqual(['0xabcdef0000000000000000000000000000000001'])
    expect(mocks.refreshAllowedMarketCreatorSiteSources).toHaveBeenCalledWith({ force: false })
    expect(mocks.update).toHaveBeenCalledTimes(2)
  })
})
