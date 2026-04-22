import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  safeParse: vi.fn(),
  resolveMarketContextRequest: vi.fn(),
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
    mocks.safeParse.mockReset()
    mocks.resolveMarketContextRequest.mockReset()
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

  it('delegates validated payloads to the service', async () => {
    const payload = {
      slug: 'event-slug',
      marketConditionId: 'condition-1',
      readOnly: true,
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
        'x-kuest-locale': 'pt',
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
    expect(mocks.resolveMarketContextRequest).toHaveBeenCalledWith(payload, 'pt')
  })
})
