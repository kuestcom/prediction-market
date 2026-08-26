import type { AnchorHTMLAttributes } from 'react'

import { render, screen } from '@testing-library/react'

import type { PublicPosition } from '@/app/[locale]/(platform)/profile/_components/PublicPositionItem'

import PublicPositionsRow from '@/app/[locale]/(platform)/profile/_components/PublicPositionsRow'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: function MockLink({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
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

function renderRow(outcome: string, outcomeIndex: number) {
  const position: PublicPosition = {
    id: 'position-up',
    title: 'Active market',
    slug: 'active-market',
    eventSlug: 'active-event',
    avgPrice: 0.5,
    currentValue: 5,
    timestamp: 1,
    status: 'active',
    outcome,
    outcomeIndex,
    size: 10,
    curPrice: 0.5,
  }

  render(
    <table>
      <tbody>
        <PublicPositionsRow position={position} onShareClick={() => {}} />
      </tbody>
    </table>,
  )
}

describe('publicPositionsRow', () => {
  it('uses outcome index so Up is colored as the first outcome', () => {
    renderRow('Up', 0)

    expect(screen.getByText(/^Up 50/)).toHaveClass('text-yes')
  })

  it('colors the second outcome red even when its label is custom', () => {
    renderRow('Down', 1)

    expect(screen.getByText(/^Down 50/)).toHaveClass('text-no')
  })
})
