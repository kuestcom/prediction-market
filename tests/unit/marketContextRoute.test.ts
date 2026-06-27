import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  getCurrentUser: vi.fn(),
  safeParse: vi.fn(),
  resolveMarketContextRequest: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (...args: any[]) => mocks.cookieGet(...args),
    set: (...args: any[]) => mocks.cookieSet(...args),
  })),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/market-context-service', () => ({
  MarketContextRequestSchema: {
    safeParse: (...args: any[]) => mocks.safeParse(...args),
  },
  resolveMarketContextRequest: (...args: any[]) => mocks.resolveMarketContextRequest(...args),
}))

const { POST } = await import('@/app/api/market-context/route')

describe('market context route', () => {
  beforeEach(() => {
    mocks.cookieGet.mockReset()
    mocks.cookieSet.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.safeParse.mockReset()
    mocks.resolveMarketContextRequest.mockReset()
    mocks.resolveMarketContextRequest.mockImplementation(async (_payload, options) => {
      const generationGate = await options?.beforeGenerate?.()
      if (generationGate) {
        return generationGate
      }

      return {
        context: 'generated context',
        expiresAt: '2026-06-27T15:00:00.000Z',
        updatedAt: '2026-06-27T14:30:00.000Z',
        cached: false,
      }
    })
  })

  it('returns 400 for schema-invalid payloads', async () => {
    mocks.safeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid request.' }] },
    })

    const response = await POST(new Request('https://example.com/api/market-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request.' })
    expect(mocks.resolveMarketContextRequest).not.toHaveBeenCalled()
  })

  it('delegates read-only payloads to the service without requiring a session', async () => {
    const payload = {
      slug: 'event-slug',
      marketConditionId: 'condition-1',
      readOnly: true,
      locale: 'pt',
    }

    mocks.safeParse.mockReturnValue({
      success: true,
      data: payload,
    })
    mocks.resolveMarketContextRequest.mockResolvedValue({
      context: null,
      expiresAt: null,
      updatedAt: null,
      cached: false,
    })

    const response = await POST(new Request('https://example.com/api/market-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      context: null,
      expiresAt: null,
      updatedAt: null,
      cached: false,
    })
    expect(mocks.resolveMarketContextRequest).toHaveBeenCalledWith(payload, expect.any(Object))
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })

  it('allows anonymous generation while under the quota', async () => {
    const payload = {
      slug: 'event-slug',
      marketConditionId: 'condition-1',
      locale: 'pt',
    }

    mocks.safeParse.mockReturnValue({
      success: true,
      data: payload,
    })
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const response = await POST(new Request('https://example.com/api/market-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      context: 'generated context',
      expiresAt: '2026-06-27T15:00:00.000Z',
      updatedAt: '2026-06-27T14:30:00.000Z',
      cached: false,
    })
    expect(mocks.getCurrentUser).toHaveBeenCalledWith({ minimal: true })
    expect(mocks.resolveMarketContextRequest).toHaveBeenCalledWith(payload, expect.any(Object))
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'market_context_generation_quota',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        maxAge: 86400,
        path: '/',
        sameSite: 'lax',
      }),
    )
  })

  it('delegates generation requests for authenticated users', async () => {
    const payload = {
      slug: 'event-slug',
      marketConditionId: 'condition-1',
      locale: 'pt',
    }

    mocks.safeParse.mockReturnValue({
      success: true,
      data: payload,
    })
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1' })

    const response = await POST(new Request('https://example.com/api/market-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      context: 'generated context',
      expiresAt: '2026-06-27T15:00:00.000Z',
      updatedAt: '2026-06-27T14:30:00.000Z',
      cached: false,
    })
    expect(mocks.getCurrentUser).toHaveBeenCalledWith({ minimal: true })
    expect(mocks.resolveMarketContextRequest).toHaveBeenCalledWith(payload, expect.any(Object))
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'market_context_generation_quota',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        maxAge: 86400,
        path: '/',
        sameSite: 'lax',
      }),
    )
  })

  it('blocks generation after five attempts in the quota window', async () => {
    const payload = {
      slug: 'event-slug',
      marketConditionId: 'condition-1',
      locale: 'pt',
    }
    let quotaCookie: string | undefined

    mocks.safeParse.mockReturnValue({
      success: true,
      data: payload,
    })
    mocks.getCurrentUser.mockResolvedValue(null)
    mocks.cookieGet.mockImplementation(() => quotaCookie ? { value: quotaCookie } : undefined)
    mocks.cookieSet.mockImplementation((_name, value) => {
      quotaCookie = value
    })

    for (let index = 0; index < 5; index += 1) {
      const response = await POST(new Request('https://example.com/api/market-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }))

      expect(response.status).toBe(200)
    }

    const limitedResponse = await POST(new Request('https://example.com/api/market-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }))

    expect(limitedResponse.status).toBe(429)
    await expect(limitedResponse.json()).resolves.toEqual({
      error: 'Market context generation limit reached. Try again later.',
    })
  })
})
