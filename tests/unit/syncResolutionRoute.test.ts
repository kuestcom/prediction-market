import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  fetch: vi.fn(),
  isCronAuthorized: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth-cron', () => ({
  isCronAuthorized: (...args: any[]) => mocks.isCronAuthorized(...args),
}))

vi.mock('@/lib/db/utils/run-query', () => ({
  runQuery: async (callback: () => Promise<unknown>) => await callback(),
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    execute: (...args: any[]) => mocks.execute(...args),
    select: (...args: any[]) => mocks.select(...args),
    update: (...args: any[]) => mocks.update(...args),
  },
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

describe('sync resolution route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', mocks.fetch)

    mocks.execute.mockReset()
    mocks.fetch.mockReset()
    mocks.isCronAuthorized.mockReset()
    mocks.select.mockReset()
    mocks.update.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hits the resolution subgraph and exits cleanly when no tracked authors are returned', async () => {
    mocks.isCronAuthorized.mockReturnValue(true)
    mocks.execute.mockResolvedValueOnce([
      {
        creator: '0xABCDEF0000000000000000000000000000000001',
      },
    ])
    mocks.select.mockImplementation(() => makeSelectChain([]))
    mocks.update.mockImplementation(() => makeUpdateChain([{ id: 'sync-row' }]))
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          marketResolutions: [],
        },
      }),
    })

    const { GET } = await import('@/app/api/sync/resolution/route')
    const response = await GET(new Request('https://example.com/api/sync/resolution', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      fetched: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      timeLimitReached: false,
    })

    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://subgraphs.kuest.com/resolution-subgraph',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      }),
    )

    const requestBody = JSON.parse(String(mocks.fetch.mock.calls[0][1].body))
    expect(requestBody.variables.authors).toEqual(['0xabcdef0000000000000000000000000000000001'])
    expect(mocks.update).toHaveBeenCalledTimes(2)
  })
})
