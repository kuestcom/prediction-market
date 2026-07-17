import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EventCardHeader from '@/app/[locale]/(platform)/(home)/_components/EventCardHeader'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: function MockLink({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

vi.mock('@/components/EventIconImage', () => ({
  default: () => <span data-testid="event-icon" />,
}))

const EVENT = {
  id: 'event-1',
  slug: 'highest-temperature-sao-paulo',
  title: 'Highest temperature in Sao Paulo on June 9?',
  creator: 'Kuest',
  icon_url: null,
  status: 'active',
  markets: [
    {
      condition_id: 'market-1',
      is_resolved: false,
      condition: {
        resolved: false,
      },
    },
  ],
  tags: [],
} as any

describe('eventCardHeader', () => {
  it('shows an unavailable chance label for single-market cards without displayable volume', () => {
    render(
      <EventCardHeader
        event={EVENT}
        title={EVENT.title}
        isSingleMarket
        primaryMarket={{
          ...EVENT.markets[0],
          volume: 0,
          volume_24h: 0,
          outcomes: [],
          condition: {
            resolved: false,
            volume: 0,
          },
        } as any}
        roundedPrimaryDisplayChance={null}
      />,
    )

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('chance')).toBeInTheDocument()
  })
})
