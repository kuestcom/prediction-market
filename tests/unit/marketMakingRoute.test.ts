import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'
import { NextRequest } from 'next/server'

import { hoisted, stubGlobal, unstubAllGlobals, useRealTimers } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  fetch: mock(),
  getCurrentUser: mock(),
  select: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
void mock.module('@/lib/drizzle', () => ({ db: { select: (...args: unknown[]) => mocks.select(...args) } }))
void mock.module('@/lib/public-runtime-config.shared', () => ({
  resolvePublicRuntimeEnv: () => ({ escrowUrl: 'https://escrow.test', polymarketGammaUrl: 'https://gamma.test' }),
}))
void mock.module('@/lib/storage', () => ({ getPublicAssetUrl: (value: string) => value }))

const { GET } = await import('@/app/[locale]/admin/api/market-making/route')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestFor(query: string) {
  const params = new URLSearchParams({ source: 'polymarket', q: query })
  return new NextRequest(`http://localhost/admin/api/market-making?${params}`)
}

describe('market-making Polymarket URL search', () => {
  beforeEach(() => {
    stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.select.mockReset()
    mocks.getCurrentUser.mockResolvedValue({ is_admin: true })
    mocks.select.mockImplementation(() => ({
      from: () => ({
        innerJoin: () => ({ where: async () => [] }),
      }),
    }))
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ importConfig: { minimumEventLeadTimeSeconds: 0 } }))
  })

  afterEach(() => {
    useRealTimers()
    unstubAllGlobals()
  })

  it.each([
    {
      query: 'https://polymarket.com/event/example-event',
      endpoint: 'https://gamma.test/events/slug/example-event',
      payload: {
        id: 'event-1',
        slug: 'example-event',
        title: 'Example event',
        active: true,
        markets: [
          {
            conditionId: '0xevent',
            question: 'Example market',
            active: true,
            acceptingOrders: true,
            endDate: '2026-09-30T00:00:00.000Z',
          },
        ],
      },
      title: 'Example event',
    },
    {
      query: 'https://www.polymarket.com/market/example-market?tid=1',
      endpoint: 'https://gamma.test/markets/slug/example-market',
      payload: {
        slug: 'example-market',
        question: 'Example market',
        conditionId: '0xmarket',
        active: true,
        acceptingOrders: true,
        endDate: '2026-09-30T00:00:00.000Z',
      },
      title: 'Example market',
    },
  ])('looks up $query by slug', async ({ query, endpoint, payload, title }) => {
    jest.setSystemTime(new Date('2026-08-30T00:00:00.000Z'))
    mocks.fetch.mockResolvedValueOnce(jsonResponse(payload))

    const response = await GET(requestFor(query))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.fetch.mock.calls[1]?.[0]).toBe(endpoint)
    expect(body.data[0]).toMatchObject({ source: 'polymarket', title })
  })

  it('uses a valid long Polymarket URL for direct slug lookup', async () => {
    const slug = `market-${'a'.repeat(130)}`
    const query = `https://polymarket.com/market/${slug}`
    expect(query.length).toBeGreaterThan(120)
    jest.setSystemTime(new Date('2026-08-30T00:00:00.000Z'))
    mocks.fetch.mockResolvedValueOnce(
      jsonResponse({
        slug,
        question: 'Long market',
        conditionId: '0xlong',
        active: true,
        acceptingOrders: true,
        endDate: '2026-09-30T00:00:00.000Z',
      }),
    )

    const response = await GET(requestFor(query))

    expect(response.status).toBe(200)
    expect(mocks.fetch.mock.calls[1]?.[0]).toBe(`https://gamma.test/markets/slug/${slug}`)
  })

  it('limits ordinary text searches to 120 characters', async () => {
    const query = 'a'.repeat(180)
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ events: [] }))

    const response = await GET(requestFor(query))
    const endpoint = new URL(String(mocks.fetch.mock.calls[1]?.[0]))

    expect(response.status).toBe(200)
    expect(endpoint.searchParams.get('q')).toBe(query.slice(0, 120))
  })
})
