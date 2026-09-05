import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as React from 'react'

import AdminAffiliateSettingsForm from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  refresh: mock(),
  updateAction: mock(),
  user: {
    deposit_wallet_address: '0x1111111111111111111111111111111111111111',
  },
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }) => (typeof value === 'string' ? value : value.message),
}))

void mock.module('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

void mock.module('next/form', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => React.createElement('form', props, children),
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    success: mock(),
    error: mock(),
  },
}))

void mock.module('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings', () => ({
  updateForkSettingsAction: (...args: any[]) => mocks.updateAction(...args),
}))

void mock.module('@/stores/useUser', () => ({
  useUser: () => mocks.user,
}))

function renderForm(initialWallet = '') {
  return render(
    <AdminAffiliateSettingsForm
      builderTakerFeeShareBps={3000}
      builderMakerFlatFeeBps={0}
      affiliateShareBps={1500}
      hasSavedBuilderTakerShare={false}
      initialFeeRecipientWallet={initialWallet}
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

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon(?: Amoy)?\)/i) as HTMLInputElement
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

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon(?: Amoy)?\)/i) as HTMLInputElement
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

    const input = screen.getByLabelText(/Fee Wallet Address \(Polygon(?: Amoy)?\)/i) as HTMLInputElement

    expect(input.value).toBe(mocks.user.deposit_wallet_address)
    expect(screen.queryByRole('button', { name: /Use my deposit wallet/i })).toBeNull()
  })
})
