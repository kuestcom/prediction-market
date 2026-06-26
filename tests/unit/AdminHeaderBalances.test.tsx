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
  http: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
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
  defaultViemNetwork: { id: 137, name: 'Polygon' },
  resolveViemRpcUrl: () => 'https://rpc.example.test',
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: (...args: unknown[]) => mocks.createPublicClient(...args),
    http: (...args: unknown[]) => mocks.http(...args),
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
    mocks.http.mockReturnValue('http-transport')
    mocks.useQuery.mockReturnValue({
      data: 1.2345,
      isLoading: false,
    })
    mocks.createPublicClient.mockClear()
    mocks.http.mockClear()
    mocks.toastSuccess.mockReset()
    mocks.toastError.mockReset()

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders admin balances and copies the connected EOA on click', async () => {
    render(<AdminHeaderBalances />)

    expect(screen.getByText('Admin POL')).toBeInTheDocument()
    expect(screen.getByText('Admin USDC')).toBeInTheDocument()
    expect(screen.getByText('1.23')).toBeInTheDocument()
    expect(screen.getByText('42.50')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /admin pol/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0x00000000000000000000000000000000000000AA')
      expect(mocks.toastSuccess).toHaveBeenCalledWith('EOA wallet copied.')
    })
  })

  it('creates a fixed public client for the app chain', () => {
    render(<AdminHeaderBalances />)

    expect(mocks.http).toHaveBeenCalledWith('https://rpc.example.test')
    expect(mocks.createPublicClient).toHaveBeenCalledWith({
      chain: { id: 137, name: 'Polygon' },
      transport: 'http-transport',
    })
  })
})
