import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDirectUsdcDepositExecution } from '@/hooks/useDirectUsdcDepositExecution'
import { DEFAULT_CHAIN_ID } from '@/lib/network'

const mocks = vi.hoisted(() => ({
  publicClient: {
    waitForTransactionReceipt: vi.fn(),
  },
  switchChainAsync: vi.fn(),
  walletClient: {
    chain: { id: 1 },
    sendTransaction: vi.fn(),
  },
}))

vi.mock('wagmi', () => ({
  usePublicClient: () => mocks.publicClient,
  useSwitchChain: () => ({ switchChainAsync: mocks.switchChainAsync }),
  useWalletClient: () => ({ data: mocks.walletClient }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useDirectUsdcDepositExecution', () => {
  beforeEach(() => {
    mocks.switchChainAsync.mockReset().mockResolvedValue({ id: DEFAULT_CHAIN_ID })
    mocks.walletClient.sendTransaction.mockReset().mockResolvedValue(
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    )
    mocks.publicClient.waitForTransactionReceipt.mockReset().mockResolvedValue({
      status: 'success',
    })
  })

  it('switches to the default chain before submitting a direct USDC deposit', async () => {
    const { result } = renderHook(() => useDirectUsdcDepositExecution({
      amountValue: '1',
      fromAddress: '0x0000000000000000000000000000000000000001',
      toAddress: '0x0000000000000000000000000000000000000002',
    }), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.execute()
    })

    expect(mocks.switchChainAsync).toHaveBeenCalledWith({ chainId: DEFAULT_CHAIN_ID })
    expect(mocks.switchChainAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.walletClient.sendTransaction.mock.invocationCallOrder[0]!,
    )
  })
})
