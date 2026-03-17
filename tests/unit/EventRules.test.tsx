import type { Event } from '@/types'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useLocale: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
  useLocale: () => mocks.useLocale(),
}))

vi.mock('@/components/ui/button', () => ({
  Button: function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => ({ name: 'Kuest' }),
}))

vi.mock('@/lib/uma', () => ({
  resolveUmaProposeTarget: () => null,
}))

const { default: EventRules } = await import('@/app/[locale]/(platform)/event/[slug]/_components/EventRules')

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Event 1',
    creator: 'Creator',
    icon_url: '',
    show_market_icons: false,
    status: 'active',
    active_markets_count: 1,
    total_markets_count: 1,
    volume: 0,
    end_date: '2026-02-10T00:00:00.000Z',
    created_at: '2026-02-05T19:25:00.000Z',
    updated_at: '2026-02-05T19:25:00.000Z',
    rules: 'Resolves according to the official source.',
    tags: [],
    main_tag: 'trending',
    is_bookmarked: false,
    is_trending: false,
    markets: [
      {
        condition_id: 'condition-1',
        outcomes: [],
      } as any,
    ],
    ...overrides,
  }
}

describe('eventRules', () => {
  beforeEach(() => {
    mocks.useLocale.mockReset()
    mocks.useLocale.mockReturnValue('en')
  })

  it('renders the created-at label for english with the full localized timestamp', () => {
    render(<EventRules event={createEvent()} mode="inline" />)

    expect(screen.getByText((_, node) => (
      node?.tagName === 'P' && node.textContent === 'Created At: Feb 5, 2026, 2:25 PM ET'
    ))).toBeInTheDocument()
  })

  it('renders the same english timestamp format for non-english locales', () => {
    mocks.useLocale.mockReturnValue('zh')

    render(<EventRules event={createEvent()} mode="inline" />)

    expect(screen.getByText((_, node) => (
      node?.tagName === 'P' && node.textContent === 'Created At: Feb 5, 2026, 2:25 PM ET'
    ))).toBeInTheDocument()
  })
})
