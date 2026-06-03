import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import AdminAffiliateContentClient from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateContentClient'

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm', () => ({
  __esModule: true,
  default: function AdminAffiliateSettingsFormMock({ initialFeeRecipientWallet }: any) {
    const [draftWallet, setDraftWallet] = React.useState(initialFeeRecipientWallet)

    return React.createElement(
      'div',
      null,
      React.createElement('span', { 'data-testid': 'draft-wallet' }, draftWallet),
      React.createElement('button', {
        type: 'button',
        onClick: () => setDraftWallet('0x2222222222222222222222222222222222222222'),
      }, 'Change draft wallet'),
    )
  },
}))

vi.mock('@/app/[locale]/admin/affiliate/_components/AdminAffiliateClaimableFeesCard', () => ({
  __esModule: true,
  default: ({ feeRecipientWallet }: any) => React.createElement(
    'div',
    { 'data-testid': 'claim-wallet' },
    feeRecipientWallet,
  ),
}))

describe('adminAffiliateContentClient', () => {
  it('keeps the claim card bound to the saved wallet until refresh', async () => {
    const user = userEvent.setup()
    const props = {
      builderTakerFeeBps: 250,
      builderMakerFeeBps: 125,
      affiliateShareBps: 1550,
      initialFeeRecipientWallet: '0x1111111111111111111111111111111111111111',
      kuestFeeSettings: null,
      updatedAtLabel: '2026-05-08 20:43:23 UTC',
      aggregate: {
        totalVolume: 0,
        totalAffiliateFees: 0,
        totalReferrals: 0,
      },
    } as const

    const { rerender } = render(<AdminAffiliateContentClient {...props} />)

    expect(screen.getByTestId('draft-wallet')).toHaveTextContent(props.initialFeeRecipientWallet)
    expect(screen.getByTestId('claim-wallet')).toHaveTextContent(props.initialFeeRecipientWallet)

    await user.click(screen.getByRole('button', { name: 'Change draft wallet' }))

    expect(screen.getByTestId('draft-wallet')).toHaveTextContent('0x2222222222222222222222222222222222222222')
    expect(screen.getByTestId('claim-wallet')).toHaveTextContent(props.initialFeeRecipientWallet)

    rerender(
      <AdminAffiliateContentClient
        {...props}
        initialFeeRecipientWallet="0x3333333333333333333333333333333333333333"
      />,
    )

    expect(screen.getByTestId('draft-wallet')).toHaveTextContent('0x3333333333333333333333333333333333333333')
    expect(screen.getByTestId('claim-wallet')).toHaveTextContent('0x3333333333333333333333333333333333333333')
  })
})
