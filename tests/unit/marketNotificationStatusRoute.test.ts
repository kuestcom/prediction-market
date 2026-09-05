import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const CONDITION_A = `0x${'a'.repeat(64)}`
const CONDITION_B = `0x${'b'.repeat(64)}`
const CREATOR = '0x1111111111111111111111111111111111111111'

const mocks = hoisted(() => ({
  findMany: mock(),
  loadAllowedMarketCreatorWallets: mock(),
}))

void mock.module('@/lib/allowed-market-creators-server', () => ({
  loadAllowedMarketCreatorWallets: (...args: unknown[]) => mocks.loadAllowedMarketCreatorWallets(...args),
}))

void mock.module('@/lib/drizzle', () => ({
  db: (() => {
    const transactionDb = {
      query: { events: { findMany: (...args: unknown[]) => mocks.findMany(...args) } },
      execute: mock(),
      select: () => ({
        from: () => ({
          where: () => ({ getSQL: () => ({}) }),
        }),
      }),
    }
    return {
      ...transactionDb,
      transaction: (callback: (transaction: typeof transactionDb) => unknown) => callback(transactionDb),
    }
  })(),
}))

const { POST } = await import('@/app/api/markets/status/route')

function createRequest(conditionIds: unknown) {
  return new Request('https://markets.example/api/markets/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditionIds }),
  })
}

describe('market notification status route', () => {
  beforeEach(() => {
    mocks.findMany.mockReset()
    mocks.loadAllowedMarketCreatorWallets.mockReset()
    mocks.loadAllowedMarketCreatorWallets.mockResolvedValue({ data: [CREATOR], error: null })
    mocks.findMany.mockResolvedValue([
      {
        slug: 'major-final',
        is_hidden: false,
        status: 'active',
        sports: {
          sports_sport_slug: 'counter-strike',
          sports_league_slug: 'blast',
          sports_event_slug: 'major-final',
        },
        eventTags: [
          { tag: { slug: 'esports', is_main_category: true, hide_events: false } },
          { tag: { slug: 'games', is_main_category: false, hide_events: false } },
        ],
        markets: [
          {
            condition_id: CONDITION_A,
            slug: 'match-winner',
            metadata: JSON.stringify({ acceptingOrders: true, archived: false }),
            is_active: true,
            is_resolved: false,
            condition: { creator: CREATOR, resolved: false },
          },
        ],
      },
    ])
  })

  it('returns one ordered row per requested ID and a direct market path only when eligible', async () => {
    const response = await POST(createRequest([CONDITION_A.toUpperCase(), CONDITION_B]))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          condition_id: CONDITION_A,
          is_resolved: false,
          notification_eligible: true,
          direct_path: '/esports/counter-strike/blast/major-final/match-winner',
        },
        {
          condition_id: CONDITION_B,
          is_resolved: false,
          notification_eligible: false,
          direct_path: null,
        },
      ],
    })
    expect(mocks.findMany).toHaveBeenCalledTimes(1)
  })

  it('applies visibility, creator and market activity gates without omitting the row', async () => {
    mocks.findMany.mockResolvedValueOnce([
      {
        slug: 'hidden-event',
        is_hidden: true,
        status: 'active',
        sports: null,
        eventTags: [],
        markets: [
          {
            condition_id: CONDITION_A,
            slug: 'winner',
            metadata: null,
            is_active: true,
            is_resolved: false,
            condition: { creator: CREATOR, resolved: false },
          },
        ],
      },
    ])

    const response = await POST(createRequest([CONDITION_A]))
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          condition_id: CONDITION_A,
          is_resolved: false,
          notification_eligible: false,
          direct_path: null,
        },
      ],
    })
  })

  it('rejects malformed IDs and oversized batches before querying', async () => {
    const malformedResponse = await POST(createRequest(['condition-1']))
    const oversizedResponse = await POST(createRequest(Array.from({ length: 201 }, () => CONDITION_A)))

    expect(malformedResponse.status).toBe(400)
    expect(oversizedResponse.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
