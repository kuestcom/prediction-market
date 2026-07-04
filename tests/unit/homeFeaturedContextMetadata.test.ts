import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { deflateSync, gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
  lookup: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: (...args: unknown[]) => mocks.lookup(...args),
  },
  lookup: (...args: unknown[]) => mocks.lookup(...args),
}))

vi.mock('node:http', () => ({
  default: {
    request: (...args: unknown[]) => mocks.httpRequest(...args),
  },
  request: (...args: unknown[]) => mocks.httpRequest(...args),
}))

vi.mock('node:https', () => ({
  default: {
    request: (...args: unknown[]) => mocks.httpsRequest(...args),
  },
  request: (...args: unknown[]) => mocks.httpsRequest(...args),
}))

interface MockResponsePayload {
  body?: string | Buffer
  headers?: Record<string, string>
  status?: number
}

function createRequestMock(responses: MockResponsePayload[]) {
  return vi.fn((options: any, callback: (response: any) => void) => {
    const request = new EventEmitter() as any
    request.destroy = vi.fn((error?: Error) => {
      request.emit('error', error ?? new Error('Request destroyed.'))
    })
    request.end = vi.fn(() => {
      function respond() {
        const payload = responses.shift()
        if (!payload) {
          request.emit('error', new Error('Missing mock response.'))
          return
        }

        const response = new PassThrough() as any
        response.statusCode = payload.status ?? 200
        response.headers = payload.headers ?? {}

        callback(response)
        if (payload.body) {
          response.write(typeof payload.body === 'string' ? Buffer.from(payload.body) : payload.body)
        }
        response.end()
      }

      if (typeof options.lookup === 'function') {
        options.lookup(String(options.hostname), {}, (error: Error | null) => {
          if (error) {
            request.emit('error', error)
            return
          }

          respond()
        })
        return
      }

      respond()
    })

    return request
  })
}

describe('fetchHomeFeaturedNewsMetadata', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.httpRequest.mockReset()
    mocks.httpsRequest.mockReset()
    mocks.lookup.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the final redirect URL for returned URL, source host, and relative favicon', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.httpsRequest.mockImplementation(createRequestMock([
      {
        status: 302,
        headers: { location: 'https://final.example/news/story' },
      },
      {
        status: 200,
        body: '<html><head><title>Final Story</title><link rel="icon" href="/favicon.png"></head></html>',
      },
    ]))

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    const metadata = await fetchHomeFeaturedNewsMetadata('https://short.example/go')

    expect(metadata).toEqual({
      title: 'Final Story',
      source: 'final.example',
      url: 'https://final.example/news/story',
      faviconUrl: 'https://final.example/favicon.png',
      publishedAt: null,
    })
    expect(mocks.httpsRequest).toHaveBeenCalledTimes(2)
    expect(mocks.lookup).toHaveBeenCalledWith('short.example', { all: true, verbatim: false })
    expect(mocks.lookup).toHaveBeenCalledWith('final.example', { all: true, verbatim: false })
  })

  it('rejects direct private IP destinations before request', async () => {
    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('http://127.0.0.1/admin')).rejects.toThrow('URL host is not allowed.')

    expect(mocks.httpRequest).not.toHaveBeenCalled()
    expect(mocks.httpsRequest).not.toHaveBeenCalled()
  })

  it('decompresses gzip metadata responses before parsing HTML', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.httpsRequest.mockImplementation(createRequestMock([{
      status: 200,
      headers: { 'content-encoding': 'gzip' },
      body: gzipSync('<html><head><title>Compressed Story</title></head></html>'),
    }]))

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    const metadata = await fetchHomeFeaturedNewsMetadata('https://news.example/article')

    expect(metadata.title).toBe('Compressed Story')
    expect(metadata.source).toBe('news.example')
  })

  it('decompresses stacked metadata response encodings in reverse order', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.httpsRequest.mockImplementation(createRequestMock([{
      status: 200,
      headers: { 'content-encoding': 'deflate, gzip' },
      body: gzipSync(deflateSync('<html><head><title>Stacked Story</title></head></html>')),
    }]))

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    const metadata = await fetchHomeFeaturedNewsMetadata('https://news.example/article')

    expect(metadata.title).toBe('Stacked Story')
    expect(metadata.source).toBe('news.example')
  })

  it('rejects IPv4-mapped IPv6 private IP destinations before request', async () => {
    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('http://[::ffff:127.0.0.1]/admin')).rejects.toThrow('URL host is not allowed.')

    expect(mocks.httpRequest).not.toHaveBeenCalled()
    expect(mocks.httpsRequest).not.toHaveBeenCalled()
  })

  it('rejects hostnames that resolve to private IP destinations before response handling', async () => {
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    mocks.httpsRequest.mockImplementation(createRequestMock([{ status: 200, body: '<title>Blocked</title>' }]))

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('https://news.example/article')).rejects.toThrow('URL host is not allowed.')

    expect(mocks.httpsRequest).toHaveBeenCalledTimes(1)
  })

  it('rejects redirects to private IP destinations before following them', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.httpsRequest.mockImplementation(createRequestMock([{
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    }]))

    const { fetchHomeFeaturedNewsMetadata } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('https://news.example/redirect')).rejects.toThrow('URL host is not allowed.')

    expect(mocks.httpsRequest).toHaveBeenCalledTimes(1)
    expect(mocks.httpRequest).not.toHaveBeenCalled()
  })

  it('wraps DNS lookup failures as URL errors', async () => {
    mocks.lookup.mockRejectedValue(new Error('ENOTFOUND news.example'))
    mocks.httpsRequest.mockImplementation(createRequestMock([{ status: 200, body: '<title>Blocked</title>' }]))

    const { fetchHomeFeaturedNewsMetadata, HomeFeaturedNewsMetadataUrlError } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('https://news.example/article')).rejects.toMatchObject({
      message: 'Could not resolve URL host.',
      name: HomeFeaturedNewsMetadataUrlError.name,
    })
  })

  it('wraps network failures as URL errors without leaking system details', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mocks.httpsRequest.mockImplementationOnce((options: any) => {
      const request = new EventEmitter() as any
      request.destroy = vi.fn()
      request.end = vi.fn(() => {
        options.lookup(String(options.hostname), {}, (error: Error | null) => {
          request.emit('error', error ?? new Error('ECONNRESET private detail'))
        })
      })
      return request
    })

    const { fetchHomeFeaturedNewsMetadata, HomeFeaturedNewsMetadataUrlError } = await import('@/lib/home-featured-context-metadata')
    await expect(fetchHomeFeaturedNewsMetadata('https://news.example/article')).rejects.toMatchObject({
      message: 'Could not fetch URL metadata.',
      name: HomeFeaturedNewsMetadataUrlError.name,
    })
  })
})
