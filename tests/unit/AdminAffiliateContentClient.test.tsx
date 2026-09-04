import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, mock } from 'bun:test'
import * as React from 'react'

import AdminAffiliateContentClient from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateContentClient'

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }) => (typeof value === 'string' ? value : value.message),
}))

void mock.module('@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm', () => ({
  __esModule: true,
  default: function AdminAffiliateSettingsFormMock({ initialFeeRecipientWallet }: any) {
    const [draftWallet, setDraftWallet] = React.useState(initialFeeRecipientWallet)

    return React.createElement(
      'div',
      null,
      React.createElement('span', { 'data-testid': 'draft-wallet' }, draftWallet),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => setDraftWallet('0x2222222222222222222222222222222222222222'),
        },
        'Change draft wallet',
      ),
    )
  },
}))

void mock.module('@/app/[locale]/admin/affiliate/_components/AdminAffiliateClaimableFeesCard', () => ({
  __esModule: true,
  default: ({ feeRecipientWallet }: any) =>
    React.createElement('div', { 'data-testid': 'claim-wallet' }, feeRecipientWallet),
}))

describe('adminAffiliateContentClient', () => {
  it('keeps the claim card bound to the saved wallet until refresh', async () => {
    const user = userEvent.setup()
    const props = {
      builderTakerFeeShareBps: 3000,
      builderMakerFlatFeeBps: 0,
      affiliateShareBps: 1550,
      hasSavedBuilderTakerShare: true,
      initialFeeRecipientWallet: '0x1111111111111111111111111111111111111111',
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
      <AdminAffiliateContentClient {...props} initialFeeRecipientWallet="0x3333333333333333333333333333333333333333" />,
    )

    expect(screen.getByTestId('draft-wallet')).toHaveTextContent('0x3333333333333333333333333333333333333333')
    expect(screen.getByTestId('claim-wallet')).toHaveTextContent('0x3333333333333333333333333333333333333333')
  })
})
