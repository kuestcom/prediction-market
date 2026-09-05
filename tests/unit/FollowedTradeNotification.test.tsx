import { render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import {
  FollowedTradeAvatar,
  FollowedTradeMarketContext,
  FollowedTradeSummary,
  formatTradeAlertTraderLabel,
  resolveTradeAlertOutcomeColorClass,
} from '@/components/FollowedTradeNotification'

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

describe('FollowedTradeNotification', () => {
  it('renders the compact activity-style trade summary', () => {
    render(<FollowedTradeSummary trader="m.maverick" side="BUY" outcome="Yes" averagePrice={0.9} totalValue={30} />)

    expect(screen.getByText('@m.maverick')).toHaveClass('font-semibold')
    expect(screen.getByText('Yes')).toHaveClass('font-semibold', 'text-yes')
    expect(screen.getByText(/at 90¢/)).toBeVisible()
    expect(screen.getByText(/\(\$30\)/)).toBeVisible()
  })

  it('adds a handle marker only to usernames', () => {
    expect(formatTradeAlertTraderLabel('m.maverick')).toBe('@m.maverick')
    expect(formatTradeAlertTraderLabel('@m.maverick')).toBe('@m.maverick')
    expect(formatTradeAlertTraderLabel('0xmeta')).toBe('@0xmeta')
    expect(formatTradeAlertTraderLabel('0x1234…abcd')).toBe('0x1234…abcd')
    expect(formatTradeAlertTraderLabel('0x123eaa8bb77e17466c527314f24106a426fa444e')).toBe(
      '0x123eaa8bb77e17466c527314f24106a426fa444e',
    )
  })

  it('uses red for negative outcomes and renders compact event context', () => {
    expect(resolveTradeAlertOutcomeColorClass('No')).toBe('text-no')
    render(<FollowedTradeMarketContext eventTitle="Will the White House call a full lid?" eventIcon="/event.png" />)
    expect(screen.getByText('Will the White House call a full lid?')).toHaveClass('line-clamp-2')
  })

  it('shows a deterministic round placeholder without a profile photo', () => {
    const { container } = render(<FollowedTradeAvatar trader="m.maverick" wallet="0xabc" />)
    expect(container.firstElementChild).toHaveClass('rounded-full')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
