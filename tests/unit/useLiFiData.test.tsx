import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLiFiChainsQuery, useLiFiTokensQuery, useLiFiWalletBalancesQuery } from '@/hooks/useLiFiData'
import { useLiFiWalletTokens } from '@/hooks/useLiFiWalletTokens'

const WALLET_ADDRESS = '0x0000000000000000000000000000000000000001'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('lifi data queries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refetches fresh cached data when the hooks mount', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(['lifi', 'tokens'], { tokens: {} })
    queryClient.setQueryData(['lifi', 'chains'], [])
    queryClient.setQueryData(['lifi', 'wallet-balances', WALLET_ADDRESS], {})
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/lifi/tokens') {
        return Promise.resolve(jsonResponse({ tokens: { tokens: {} } }))
      }
      if (url === '/api/lifi/chains') {
        return Promise.resolve(jsonResponse({ chains: [] }))
      }
      return Promise.resolve(jsonResponse({ balances: {} }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => {
      useLiFiTokensQuery(true)
      useLiFiChainsQuery(true)
      useLiFiWalletBalancesQuery(WALLET_ADDRESS, true)
    }, {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/lifi/chains')
    expect(fetchMock).toHaveBeenCalledWith('/api/lifi/tokens', expect.any(Object))
    expect(fetchMock).toHaveBeenCalledWith('/api/lifi/balances', expect.any(Object))
  })

  it('surfaces non-OK responses as query errors', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/lifi/tokens') {
        return Promise.resolve(jsonResponse({ error: 'Token catalog unavailable.' }, 503))
      }
      if (url === '/api/lifi/chains') {
        return Promise.resolve(new Response('bad gateway', { status: 502 }))
      }
      return Promise.resolve(jsonResponse({ error: 'Balance service unavailable.' }, 500))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => ({
      tokens: useLiFiTokensQuery(true),
      chains: useLiFiChainsQuery(true),
      balances: useLiFiWalletBalancesQuery(WALLET_ADDRESS, true),
    }), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => {
      expect(result.current.tokens.isError).toBe(true)
      expect(result.current.chains.isError).toBe(true)
      expect(result.current.balances.isError).toBe(true)
    })

    expect(result.current.tokens.error).toEqual(new Error('Token catalog unavailable.'))
    expect(result.current.chains.error).toEqual(new Error('Failed to fetch LI.FI chains.'))
    expect(result.current.balances.error).toEqual(new Error('Balance service unavailable.'))
  })

  it('handles an incomplete successful catalog without throwing during render', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/lifi/tokens') {
        return Promise.resolve(jsonResponse({ tokens: {} }))
      }
      if (url === '/api/lifi/chains') {
        return Promise.resolve(jsonResponse({ chains: [] }))
      }
      return Promise.resolve(jsonResponse({ balances: {} }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(
      () => useLiFiWalletTokens(WALLET_ADDRESS),
      { wrapper: createWrapper(createQueryClient()) },
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.current.isLoadingTokens).toBe(false)
    })

    expect(result.current.items).toEqual([])
  })
})
