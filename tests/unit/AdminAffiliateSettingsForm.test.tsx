import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  function TestHarness() {
    const [feeRecipientWallet, setFeeRecipientWallet] = React.useState(initialWallet)

    return (
      <AdminAffiliateSettingsForm
        builderTakerFeeBps={250}
        builderMakerFeeBps={125}
        affiliateShareBps={1500}
        feeRecipientWallet={feeRecipientWallet}
        onFeeRecipientWalletChange={setFeeRecipientWallet}
        kuestFeeSettings={null}
      />
    )
  }

  return render(<TestHarness />)
}

describe('AdminAffiliateSettingsForm', () => {
  beforeEach(() => {
    mocks.refresh.mockReset()
    mocks.updateAction.mockReset()
  })

  it('hides the deposit wallet button when the fee wallet field already has a value', () => {
    renderForm('0x2222222222222222222222222222222222222222')

    expect(screen.queryByRole('button', { name: /Add my Deposit Wallet/i })).toBeNull()
  })

  it('fills the field with the deposit wallet and hides the button afterwards', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /Add my Deposit Wallet/i }))

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon\)/i) as HTMLInputElement
    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Add my Deposit Wallet/i })).toBeNull()
  })
})
