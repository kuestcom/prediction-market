import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHeaderBalances from '@/app/[locale]/admin/_components/AdminHeaderBalances'

const mocks = vi.hoisted(() => ({
  useAppKitAccount: vi.fn(),
  useBalance: vi.fn(),
  usePublicClient: vi.fn(),
  useQuery: vi.fn(),
  useUser: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
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

vi.mock('wagmi', () => ({
  usePublicClient: () => mocks.usePublicClient(),
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
    mocks.usePublicClient.mockReturnValue({
      getBalance: vi.fn(),
    })
    mocks.useQuery.mockReturnValue({
      data: 1.2345,
      isLoading: false,
    })
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
})
