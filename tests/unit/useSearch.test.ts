import { act, renderHook } from '@testing-library/react'
import { useSearch } from '@/hooks/useSearch'

describe('useSearch', () => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/api/events')) {
      const parsedUrl = new URL(url, 'http://localhost')
      const searchQuery = parsedUrl.searchParams.get('search')

      return Promise.resolve({
        ok: true,
        json: async () => (
          searchQuery === 'resolved'
            ? [{
                id: 'event-1',
                slug: 'resolved-event',
                status: 'resolved',
                title: 'Resolved Event',
                end_date: '2026-03-20T12:00:00.000Z',
                resolved_at: '2026-03-21T12:00:00.000Z',
                created_at: '2026-03-10T12:00:00.000Z',
                markets: [{ probability: 63 }],
              }]
            : searchQuery === 'mixed'
              ? [
                  {
                    id: 'event-4',
                    slug: 'older-resolved-event',
                    status: 'resolved',
                    title: 'Older Resolved Event',
                    end_date: '2026-03-18T12:00:00.000Z',
                    resolved_at: '2026-03-19T12:00:00.000Z',
                    created_at: '2026-03-01T12:00:00.000Z',
                    markets: [{ probability: 48, is_resolved: true }],
                  },
                  {
                    id: 'event-2',
                    slug: 'later-active-event',
                    status: 'active',
                    title: 'Later Active Event',
                    end_date: '2026-04-12T12:00:00.000Z',
                    resolved_at: null,
                    created_at: '2026-03-05T12:00:00.000Z',
                    markets: [{ probability: 52, is_resolved: false }],
                  },
                  {
                    id: 'event-3',
                    slug: 'newer-resolved-event',
                    status: 'resolved',
                    title: 'Newer Resolved Event',
                    end_date: '2026-03-22T12:00:00.000Z',
                    resolved_at: '2026-03-24T12:00:00.000Z',
                    created_at: '2026-03-15T12:00:00.000Z',
                    markets: [{ probability: 58, is_resolved: true }],
                  },
                  {
                    id: 'event-1',
                    slug: 'sooner-active-event',
                    status: 'active',
                    title: 'Sooner Active Event',
                    end_date: '2026-04-01T12:00:00.000Z',
                    resolved_at: null,
                    created_at: '2026-03-12T12:00:00.000Z',
                    markets: [{ probability: 63, is_resolved: false }],
                  },
                ]
              : []
        ),
      })
    }

    if (url.includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reopens the existing search results when the input is focused again', async () => {
    const { result } = renderHook(() => useSearch())

    act(() => {
      result.current.handleQueryChange('brazil')
    })

    act(() => {
      result.current.showSearchResults()
    })

    expect(result.current.showResults).toBe(true)

    act(() => {
      result.current.hideResults()
    })

    expect(result.current.showResults).toBe(false)

    act(() => {
      result.current.showSearchResults()
    })

    expect(result.current.showResults).toBe(true)
  })

  it('requests events with the combined status filter so resolved results are included', async () => {
    const { result } = renderHook(() => useSearch())

    act(() => {
      result.current.handleQueryChange('resolved')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/events?search=resolved&status=all'),
    )
    expect(result.current.results.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'resolved-event',
          status: 'resolved',
        }),
      ]),
    )
  })

  it('sorts search events with active items first and resolved items by latest resolution date after them', async () => {
    const { result } = renderHook(() => useSearch())

    act(() => {
      result.current.handleQueryChange('mixed')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current.results.events.map(event => event.slug)).toEqual([
      'sooner-active-event',
      'later-active-event',
      'newer-resolved-event',
      'older-resolved-event',
    ])
  })
})
