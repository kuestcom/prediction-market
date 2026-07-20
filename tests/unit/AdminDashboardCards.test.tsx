import type { ComponentProps } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardClaimableFeesCard from '@/app/[locale]/admin/_components/AdminDashboardClaimableFeesCard'
import AdminDashboardSparkline from '@/app/[locale]/admin/_components/AdminDashboardSparkline'
import { defaultViemNetwork } from '@/lib/viem-network'

const mocks = vi.hoisted(() => ({
  usePublicClient: vi.fn(),
}))

vi.mock('wagmi', () => ({
  usePublicClient: (...args: unknown[]) => mocks.usePublicClient(...args),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }) => typeof value === 'string' ? value : value.message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('admin dashboard cards', () => {
  beforeEach(() => {
    mocks.usePublicClient.mockReset()
  })

  it('gives the sparkline image an accessible name', () => {
    render(
      <AdminDashboardSparkline
        ariaLabel="Daily registrations"
        format="count"
        points={[{ date: '2026-07-20', value: 3 }]}
      />,
    )

    expect(screen.getByRole('img', { name: 'Daily registrations' })).toBeInTheDocument()
  })

  it('pins fee reads to the configured network and keeps totals from successful exchanges', async () => {
    const readContract = vi.fn()
      .mockResolvedValueOnce(1_000_000n)
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockResolvedValueOnce(2_000_000n)
      .mockRejectedValueOnce(new Error('RPC unavailable'))
    mocks.usePublicClient.mockReturnValue({ readContract })

    render(
      <AdminDashboardClaimableFeesCard
        feeRecipientWallet="0x1111111111111111111111111111111111111111"
      />,
    )

    expect(mocks.usePublicClient).toHaveBeenCalledWith({ chainId: defaultViemNetwork.id })
    await waitFor(() => expect(screen.getByText('$3.00')).toBeInTheDocument())
    expect(readContract).toHaveBeenCalledTimes(4)
  })
})
