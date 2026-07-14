import type { Event } from '@/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => function MockEventMarketContext() {
    return <div data-testid="event-market-context" />
  },
}))

const { default: EventMarketContextSlot } = await import(
  '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketContextSlot',
)

function createEvent(status: Event['status']): Event {
  return { status } as Event
}

describe('eventMarketContextSlot', () => {
  it('shows market context for active events when enabled', () => {
    render(<EventMarketContextSlot enabled event={createEvent('active')} />)

    expect(screen.getByTestId('event-market-context')).toBeInTheDocument()
  })

  it('hides market context when disabled', () => {
    render(<EventMarketContextSlot enabled={false} event={createEvent('active')} />)

    expect(screen.queryByTestId('event-market-context')).not.toBeInTheDocument()
  })

  it.each(['draft', 'resolved', 'archived'] as const)('hides market context for %s events', (status) => {
    render(<EventMarketContextSlot enabled event={createEvent(status)} />)

    expect(screen.queryByTestId('event-market-context')).not.toBeInTheDocument()
  })
})
