import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHeaderBalances from '@/app/[locale]/admin/_components/AdminHeaderBalances'

const mocks = vi.hoisted(() => ({
  useAppKitAccount: vi.fn(),
  useBalance: vi.fn(),
  useQuery: vi.fn(),
  useUser: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  createPublicClient: vi.fn(),
  createViemTransport: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => mocks.useAppKitAccount(),
}))

vi.mock('@/hooks/useBalance', () => ({
  useBalance: (options: unknown) => mocks.useBalance(options),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}))

vi.mock('@/lib/viem-network', () => ({
  createViemTransport: (...args: unknown[]) => mocks.createViemTransport(...args),
  defaultViemNetwork: { id: 137, name: 'Polygon' },
  resolveViemRpcUrls: () => ['https://rpc-1.example.test', 'https://rpc-2.example.test'],
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: (...args: unknown[]) => mocks.createPublicClient(...args),
  }
})

describe('adminHeaderBalances', () => {
  beforeEach(() => {
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x00000000000000000000000000000000000000aa',
    })
    mocks.useUser.mockReturnValue({
      address: '0x00000000000000000000000000000000000000bb',
    })
    mocks.useBalance.mockReturnValue({
      balance: { raw: 42.5 },
      isLoadingBalance: false,
    })
    mocks.createPublicClient.mockReturnValue({
      getBalance: vi.fn(),
    })
    mocks.createViemTransport.mockReturnValue('fallback-transport')
    mocks.useQuery.mockReturnValue({
      data: 1.2345,
      isLoading: false,
    })
    mocks.createPublicClient.mockClear()
    mocks.createViemTransport.mockClear()
    mocks.toastSuccess.mockReset()
    mocks.toastError.mockReset()

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders admin balances and copies the connected EOA on click', async () => {
    render(<AdminHeaderBalances feeRecipientWallet="0x00000000000000000000000000000000000000cc" />)

    expect(screen.getByText('Admin POL')).toBeInTheDocument()
    expect(screen.getByText('Admin USDC')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fees/i })).toHaveAttribute('href', '/admin/affiliate')
    expect(screen.getAllByText('1.23')).toHaveLength(2)
    expect(screen.getByText('42.50')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /admin pol/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0x00000000000000000000000000000000000000AA')
      expect(mocks.toastSuccess).toHaveBeenCalledWith('EOA wallet copied.')
    })
  })

  it('creates a fixed public client for the app chain', () => {
    render(<AdminHeaderBalances feeRecipientWallet="0x00000000000000000000000000000000000000cc" />)

    expect(mocks.createViemTransport).toHaveBeenCalledWith([
      'https://rpc-1.example.test',
      'https://rpc-2.example.test',
    ])
    expect(mocks.createPublicClient).toHaveBeenCalledWith({
      chain: { id: 137, name: 'Polygon' },
      transport: 'fallback-transport',
    })
  })

  it('does not present a partial claimable fee total as complete', async () => {
    interface QueryOptions {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }

    let claimableQuery: QueryOptions | undefined
    const readContract = vi.fn()
      .mockResolvedValueOnce(1_000_000n)
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockResolvedValueOnce(2_000_000n)
      .mockResolvedValueOnce(3_000_000n)
    mocks.createPublicClient.mockReturnValue({
      getBalance: vi.fn(),
      readContract,
    })
    mocks.useQuery.mockImplementation((options: unknown) => {
      const queryOptions = options as QueryOptions
      if (queryOptions.queryKey[0] === 'admin-claimable-fees') {
        claimableQuery = queryOptions
        return { data: undefined, isError: true, isLoading: false }
      }
      return { data: 1.2345, isError: false, isLoading: false }
    })

    render(<AdminHeaderBalances feeRecipientWallet="0x00000000000000000000000000000000000000cc" />)

    expect(screen.getByRole('link', { name: /fees/i })).toHaveTextContent('—')
    expect(claimableQuery).toBeDefined()
    if (!claimableQuery) {
      throw new Error('Expected the claimable fee query to be configured.')
    }
    await expect(claimableQuery.queryFn()).rejects.toThrow('Could not read claimable fees from every exchange.')
    expect(readContract).toHaveBeenCalledTimes(4)
  })

  it('keeps the last confirmed claimable balance visible after a refetch error', () => {
    mocks.useQuery.mockImplementation((options: unknown) => {
      const queryOptions = options as { queryKey: unknown[] }
      if (queryOptions.queryKey[0] === 'admin-claimable-fees') {
        return { data: 9.87, isError: true, isLoading: false }
      }
      return { data: 1.2345, isError: false, isLoading: false }
    })

    render(<AdminHeaderBalances feeRecipientWallet="0x00000000000000000000000000000000000000cc" />)

    expect(screen.getByRole('link', { name: /fees/i })).toHaveTextContent('9.87')
    expect(screen.getByText('Last confirmed value; refresh failed.')).toBeInTheDocument()
  })
})
