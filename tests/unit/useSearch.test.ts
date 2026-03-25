import { act, renderHook } from '@testing-library/react'
import { useSearch } from '@/hooks/useSearch'

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.includes('/api/events')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }

      if (url.includes('/api/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }))
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
})
