import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}))

vi.mock('@/lib/openapi-servers', () => ({
  OPENAPI_SERVER_URLS: {
    dataApi: 'https://data-api.kuest.com',
  },
}))

vi.mock('@/lib/site-url', () => ({
  default: vi.fn(() => 'https://prediction.example'),
}))

const { GET } = await import('@/lib/openapi-proxy')

describe('openapi proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mocks.fetch.mockReset()
  })

  it('does not forward app cookies to upstream docs APIs', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
        'set-cookie': 'upstream=session',
      },
    }))
    vi.stubGlobal('fetch', mocks.fetch)

    const response = await GET(new Request('https://prediction.example/docs/api/proxy?url=https%3A%2F%2Fdata-api.kuest.com%2Fv1%2Fevents', {
      method: 'GET',
      headers: {
        authorization: 'Bearer docs-token',
        cookie: 'better-auth.session_token=secret; l2-auth-context=secret',
        cookie2: 'legacy=secret',
      },
    }))

    expect(mocks.fetch).toHaveBeenCalledTimes(1)

    const fetchInit = mocks.fetch.mock.calls[0]?.[1] as RequestInit
    const upstreamHeaders = new Headers(fetchInit.headers)

    expect(upstreamHeaders.get('cookie')).toBeNull()
    expect(upstreamHeaders.get('cookie2')).toBeNull()
    expect(upstreamHeaders.get('authorization')).toBe('Bearer docs-token')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
