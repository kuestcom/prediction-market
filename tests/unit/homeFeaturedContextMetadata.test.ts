import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: (...args: unknown[]) => mocks.lookup(...args),
  },
  lookup: (...args: unknown[]) => mocks.lookup(...args),
}))

function responseMock(
  body: string,
  init: {
    status?: number
    headers?: Record<string, string>
    url?: string
  } = {},
) {
  const status = init.status ?? 200

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(init.headers),
    url: init.url ?? '',
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('fetchHomeFeaturedNewsMetadata', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.lookup.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the final redirect URL for returned URL, source host, and relative favicon', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responseMock('', {
        status: 302,
        headers: { location: 'https://final.example/news/story' },
        url: 'https://short.example/go',
      }))
      .mockResolvedValueOnce(responseMock(
        '<html><head><title>Final Story</title><link rel="icon" href="/favicon.png"></head></html>',
        { status: 200, url: 'https://final.example/news/story' },
      ))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    const metadata = await fetchHomeFeaturedNewsMetadata('https://short.example/go')

    expect(metadata).toEqual({
      title: 'Final Story',
      source: 'final.example',
      url: 'https://final.example/news/story',
      faviconUrl: 'https://final.example/favicon.png',
      publishedAt: null,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects direct private IP destinations before fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('http://127.0.0.1/admin')).rejects.toThrow('URL host is not allowed.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects IPv4-mapped IPv6 private IP destinations before fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('http://[::ffff:127.0.0.1]/admin')).rejects.toThrow('URL host is not allowed.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects hostnames that resolve to private IP destinations before fetch', async () => {
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('https://news.example/article')).rejects.toThrow('URL host is not allowed.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects redirects to private IP destinations before following them', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const fetchMock = vi.fn().mockResolvedValueOnce(responseMock('', {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
      url: 'https://news.example/redirect',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('https://news.example/redirect')).rejects.toThrow('URL host is not allowed.')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
