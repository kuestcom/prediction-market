import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBalance } from '@/hooks/useBalance'
import { useUser } from '@/stores/useUser'

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  getContract: vi.fn(),
  http: vi.fn((url: string) => ({ url })),
}))

vi.mock('viem', () => ({
  createPublicClient: mocks.createPublicClient,
  getContract: mocks.getContract,
  http: mocks.http,
}))

vi.mock('@/lib/appkit', () => ({
  defaultNetwork: {
    rpcUrls: {
      default: {
        http: ['https://rpc.local'],
      },
    },
  },
}))

vi.mock('@/lib/contracts', () => ({
  COLLATERAL_TOKEN_ADDRESS: '0x0000000000000000000000000000000000000001',
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
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

describe('useBalance', () => {
  beforeEach(() => {
    useUser.setState(null)
    mocks.createPublicClient.mockReset()
    mocks.getContract.mockReset()
    mocks.http.mockClear()
    mocks.createPublicClient.mockReturnValue({})
  })

  afterEach(() => {
    useUser.setState(null)
  })

  it('loads the Deposit Wallet balance without requiring a live wallet connection', async () => {
    const balanceOf = vi.fn().mockResolvedValue(123_450_000n)
    mocks.getContract.mockReturnValue({
      read: {
        balanceOf,
      },
    })

    useUser.setState({
      id: 'user-1',
      address: '0x00000000000000000000000000000000000000bb',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'trader',
      image: '',
      settings: {},
      is_admin: false,
      deposit_wallet_address: '0x00000000000000000000000000000000000000aa',
      deposit_wallet_status: 'deployed',
    })

    const { result } = renderHook(() => useBalance(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoadingBalance).toBe(false)
    })

    expect(balanceOf).toHaveBeenCalledWith(['0x00000000000000000000000000000000000000aa'])
    expect(result.current.balance.raw).toBe(123.45)
    expect(result.current.balance.text).toBe('123.45')
  })

  it('uses an explicit Deposit Wallet address instead of the global user state', async () => {
    const balanceOf = vi.fn().mockResolvedValue(75_000_000n)
    mocks.getContract.mockReturnValue({
      read: {
        balanceOf,
      },
    })

    useUser.setState({
      id: 'user-override',
      address: '0x00000000000000000000000000000000000000cc',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'override-user',
      image: '',
      settings: {},
      is_admin: false,
      deposit_wallet_address: '0x00000000000000000000000000000000000000aa',
      deposit_wallet_status: 'deployed',
    })

    const { result } = renderHook(() => useBalance({
      depositWalletAddress: '0x00000000000000000000000000000000000000dd',
    }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoadingBalance).toBe(false)
    })

    expect(balanceOf).toHaveBeenCalledWith(['0x00000000000000000000000000000000000000dd'])
    expect(result.current.balance.raw).toBe(75)
    expect(result.current.balance.text).toBe('75.00')
  })

  it('does not fall back to the global user state when the explicit Deposit Wallet address is null', async () => {
    mocks.getContract.mockReturnValue({
      read: {
        balanceOf: vi.fn(),
      },
    })

    useUser.setState({
      id: 'user-null-override',
      address: '0x00000000000000000000000000000000000000ee',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'null-override-user',
      image: '',
      settings: {},
      is_admin: false,
      deposit_wallet_address: '0x00000000000000000000000000000000000000aa',
      deposit_wallet_status: 'deployed',
    })

    const { result } = renderHook(() => useBalance({ depositWalletAddress: null }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoadingBalance).toBe(false)
    })

    expect(mocks.getContract).not.toHaveBeenCalled()
    expect(result.current.balance.raw).toBe(0)
    expect(result.current.balance.text).toBe('0.00')
  })

  it('stops loading when there is no Deposit Wallet to query yet', async () => {
    mocks.getContract.mockReturnValue({
      read: {
        balanceOf: vi.fn(),
      },
    })

    useUser.setState({
      id: 'user-2',
      address: '0x00000000000000000000000000000000000000cc',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'new-user',
      image: '',
      settings: {},
      is_admin: false,
      deposit_wallet_address: null,
      deposit_wallet_status: 'not_started',
    })

    const { result } = renderHook(() => useBalance(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoadingBalance).toBe(false)
    })

    expect(mocks.getContract).not.toHaveBeenCalled()
    expect(result.current.balance.raw).toBe(0)
    expect(result.current.balance.text).toBe('0.00')
  })
})
