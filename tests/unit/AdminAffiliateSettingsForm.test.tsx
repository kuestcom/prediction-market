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

describe('adminAffiliateSettingsForm', () => {
  beforeEach(() => {
    mocks.refresh.mockReset()
    mocks.updateAction.mockReset()
  })

  it('shows the saved fee wallet and offers a shortcut to use the current deposit wallet', async () => {
    renderForm('0x2222222222222222222222222222222222222222')

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon\)/i) as HTMLInputElement
    const button = screen.getByRole('button', { name: /Use my deposit wallet/i })
    const user = userEvent.setup()

    expect(input.value).toBe('0x2222222222222222222222222222222222222222')
    expect(input).toHaveAttribute('readonly')

    await user.click(button)

    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Use my deposit wallet/i })).toBeNull()
  })

  it('shows the shortcut when the fee wallet field is empty', async () => {
    renderForm()

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon\)/i) as HTMLInputElement
    const button = screen.getByRole('button', { name: /Use my deposit wallet/i })
    const user = userEvent.setup()

    expect(input.value).toBe('')
    expect(input).toHaveAttribute('readonly')

    await user.click(button)

    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Use my deposit wallet/i })).toBeNull()
  })

  it('hides the shortcut when the fee wallet already matches the deposit wallet', () => {
    renderForm(mocks.user.deposit_wallet_address)

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon\)/i) as HTMLInputElement

    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Use my deposit wallet/i })).toBeNull()
  })
})
