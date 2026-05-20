import { render, screen } from '@testing-library/react'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAffiliateSettingsForm from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateAction: vi.fn(),
  user: {
    deposit_wallet_address: '0x1111111111111111111111111111111111111111',
  },
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('next/form', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => React.createElement('form', props, children),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings', () => ({
  updateForkSettingsAction: (...args: any[]) => mocks.updateAction(...args),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.user,
}))

function renderForm(initialWallet = '') {
  return render(
    <AdminAffiliateSettingsForm
      builderTakerFeeBps={250}
      builderMakerFeeBps={125}
      affiliateShareBps={1500}
      initialFeeRecipientWallet={initialWallet}
      kuestFeeSettings={null}
    />,
  )
}

describe('AdminAffiliateSettingsForm', () => {
  beforeEach(() => {
    mocks.refresh.mockReset()
    mocks.updateAction.mockReset()
  })

  it('defaults the fee wallet field to the deposit wallet when a legacy wallet is saved', () => {
    renderForm('0x2222222222222222222222222222222222222222')

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon\)/i) as HTMLInputElement
    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Add my Deposit Wallet/i })).toBeNull()
  })

  it('defaults an empty fee wallet field to the deposit wallet', () => {
    renderForm()

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon\)/i) as HTMLInputElement
    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Add my Deposit Wallet/i })).toBeNull()
  })
})
