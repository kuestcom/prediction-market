import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  isCronAuthorized: mock(),
  loadSportsSourceProviderSettings: mock(),
  resolveSportsEvent: mock(),
  revalidateTag: mock(),
  select: mock(),
  set: mock(),
  update: mock(),
  where: mock(),
}))

void mock.module('next/cache', () => ({
  revalidateTag: (...args: any[]) => mocks.revalidateTag(...args),
}))

void mock.module('@/lib/auth-cron', () => ({
  isCronAuthorized: (...args: any[]) => mocks.isCronAuthorized(...args),
}))

void mock.module('@/lib/drizzle', () => ({
  db: {
    select: (...args: any[]) => mocks.select(...args),
    update: (...args: any[]) => mocks.update(...args),
  },
}))

void mock.module('@/lib/sports-source', () => ({
  resolveSportsEvent: (...args: any[]) => mocks.resolveSportsEvent(...args),
}))

void mock.module('@/lib/sports-source/settings', () => ({
  loadSportsSourceProviderSettings: (...args: any[]) => mocks.loadSportsSourceProviderSettings(...args),
}))

function makeSelectChain(result: unknown[]) {
  return {
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => result,
        }),
      }),
    }),
  }
}

describe('sync sports scores route', () => {
  beforeEach(() => {
    mocks.isCronAuthorized.mockReset()
    mocks.loadSportsSourceProviderSettings.mockReset()
    mocks.resolveSportsEvent.mockReset()
    mocks.revalidateTag.mockReset()
    mocks.select.mockReset()
    mocks.set.mockReset()
    mocks.update.mockReset()
    mocks.where.mockReset()

    mocks.isCronAuthorized.mockReturnValue(true)
    mocks.loadSportsSourceProviderSettings.mockResolvedValue({
      configured: true,
      theSportsDbApiKey: '123',
    })
    mocks.where.mockResolvedValue(undefined)
    mocks.set.mockImplementation(() => ({ where: (...args: any[]) => mocks.where(...args) }))
    mocks.update.mockImplementation(() => ({ set: (...args: any[]) => mocks.set(...args) }))
  })

  it('resolves each provider event once and clears live state when it has ended', async () => {
    const sharedRow = {
      livestream_url: null,
      sports_source_provider: 'thesportsdb',
      sports_source_event_id: '2519345',
      sports_source_game_id: null,
      sports_start_time: new Date('2026-07-10T19:00:00.000Z'),
      sports_live: true,
      sports_ended: false,
      sports_score: '1-1',
      sports_period: '2H',
      sports_elapsed: null,
    }
    mocks.select.mockImplementation(() =>
      makeSelectChain([
        { ...sharedRow, event_id: 'event-1', slug: 'main-market' },
        { ...sharedRow, event_id: 'event-2', slug: 'exact-score' },
        {
          ...sharedRow,
          event_id: 'event-3',
          slug: 'another-game',
          sports_source_event_id: '2519346',
        },
      ]),
    )
    mocks.resolveSportsEvent.mockResolvedValue({
      score: '2-1',
      period: 'FT',
      elapsed: null,
      live: null,
      ended: true,
      livestreamUrl: null,
      raw: { strStatus: 'FT' },
    })

    const { POST } = await import('@/app/api/sync/sports-scores/route')
    const response = await POST(
      new Request('https://example.com/api/sync/sports-scores', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )

    expect(mocks.resolveSportsEvent).toHaveBeenCalledTimes(2)
    expect(mocks.set).toHaveBeenCalledTimes(3)
    for (const [payload] of mocks.set.mock.calls) {
      expect(payload).toMatchObject({ sports_live: false })
    }
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sports_live: false,
        sports_ended: true,
      }),
    )
    await expect(response.json()).resolves.toEqual({
      checkedCount: 3,
      updatedCount: 3,
      errors: [],
    })
  })

  it('continues updating sibling events when one row write fails', async () => {
    const sharedRow = {
      livestream_url: null,
      sports_source_provider: 'thesportsdb',
      sports_source_event_id: '2519345',
      sports_source_game_id: null,
      sports_start_time: new Date('2026-07-10T19:00:00.000Z'),
      sports_live: true,
      sports_ended: false,
      sports_score: '1-1',
      sports_period: '2H',
      sports_elapsed: null,
    }
    mocks.select.mockImplementation(() =>
      makeSelectChain([
        { ...sharedRow, event_id: 'event-1', slug: 'main-market' },
        { ...sharedRow, event_id: 'event-2', slug: 'exact-score' },
        { ...sharedRow, event_id: 'event-3', slug: 'player-props' },
      ]),
    )
    mocks.resolveSportsEvent.mockResolvedValue({
      score: '2-1',
      period: 'FT',
      elapsed: null,
      live: false,
      ended: true,
      livestreamUrl: null,
      raw: { strStatus: 'FT' },
    })
    mocks.where.mockRejectedValueOnce(new Error('write failed')).mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/sync/sports-scores/route')
    const response = await POST(
      new Request('https://example.com/api/sync/sports-scores', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )

    expect(mocks.resolveSportsEvent).toHaveBeenCalledTimes(1)
    expect(mocks.set).toHaveBeenCalledTimes(3)
    expect(mocks.revalidateTag).toHaveBeenCalledWith('event:exact-score', 'max')
    expect(mocks.revalidateTag).toHaveBeenCalledWith('event:player-props', 'max')
    await expect(response.json()).resolves.toEqual({
      checkedCount: 3,
      updatedCount: 2,
      errors: [{ eventId: 'event-1', error: 'write failed' }],
    })
  })

  it('persists PandaScore map scores independently from the series score', async () => {
    mocks.select.mockImplementation(() =>
      makeSelectChain([
        {
          event_id: 'event-1',
          slug: 'main-market',
          livestream_url: null,
          sports_source_provider: 'pandascore',
          sports_source_event_id: '7001',
          sports_source_game_id: null,
          sports_start_time: new Date('2026-07-10T19:00:00.000Z'),
          sports_live: true,
          sports_ended: false,
          sports_score: '1 - 0',
          sports_segment_scores: null,
          sports_period: 'running',
          sports_elapsed: null,
        },
      ]),
    )
    mocks.resolveSportsEvent.mockResolvedValue({
      score: '1 - 0',
      segmentScores: [{ segment: 1, homeScore: 13, awayScore: 9 }],
      period: 'running',
      elapsed: null,
      live: true,
      ended: false,
      livestreamUrl: null,
      raw: {},
    })

    const { POST } = await import('@/app/api/sync/sports-scores/route')
    const response = await POST(
      new Request('https://example.com/api/sync/sports-scores', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sports_segment_scores: [{ segment: 1, homeScore: 13, awayScore: 9 }],
      }),
    )
    await expect(response.json()).resolves.toEqual({
      checkedCount: 1,
      updatedCount: 1,
      errors: [],
    })
  })
})
