import type { AnchorHTMLAttributes } from 'react'
import type { PublicPosition } from '@/app/[locale]/(platform)/profile/_components/PublicPositionItem'
import { render, screen } from '@testing-library/react'
import PublicClosedPositionsRow from '@/app/[locale]/(platform)/profile/_components/PublicClosedPositionsRow'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: function MockLink({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>
  },
}))

vi.mock('@/components/EventIconImage', () => ({
  default: () => <span data-testid="event-icon" />,
}))

function renderRow(outcomeIndex: number) {
  const position: PublicPosition = {
    id: `position-${outcomeIndex}`,
    title: 'Closed market',
    slug: 'closed-market',
    eventSlug: 'closed-event',
    avgPrice: 0.5,
    currentValue: -5,
    initialValue: 5,
    realizedPnl: -5,
    timestamp: 1,
    status: 'closed',
    outcomeIndex,
  }

  render(
    <table>
      <tbody>
        <PublicClosedPositionsRow position={position} onShareClick={() => {}} />
      </tbody>
    </table>,
  )
}

describe('publicClosedPositionsRow', () => {
  it.each([
    { outcomeIndex: 0, label: 'Yes', colorClass: 'text-yes' },
    { outcomeIndex: 1, label: 'No', colorClass: 'text-no' },
  ])('falls back to the $label outcome label and color', ({ outcomeIndex, label, colorClass }) => {
    renderRow(outcomeIndex)

    expect(screen.getByText(new RegExp(`^${label} 50`))).toHaveClass(colorClass)
  })
})
