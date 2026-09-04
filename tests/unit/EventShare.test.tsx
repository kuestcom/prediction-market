import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import type { Event } from '@/types'

import EventShare from '@/app/[locale]/(platform)/event/[slug]/_components/EventShare'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  fetchAffiliateSettingsFromAPI: mock(),
  maybeShowAffiliateToast: mock(),
  resolveEventMarketPath: mock(),
  resolveEventPagePath: mock(),
  useSiteIdentity: mock(),
  useUser: mock(),
}))

void mock.module('@/components/ui/button', () => ({
  Button: function MockButton({ children, nativeButton: _nativeButton, render, ...props }: any) {
    return render ?? <button {...props}>{children}</button>
  },
}))

void mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: function MockDropdownMenu({ children, open }: any) {
    return (
      <div data-testid="share-menu" data-state={open ? 'open' : 'closed'}>
        {children}
      </div>
    )
  },
  DropdownMenuContent: function MockDropdownMenuContent({ children, ...props }: any) {
    return <div {...props}>{children}</div>
  },
  DropdownMenuItem: function MockDropdownMenuItem({ children, closeOnClick: _closeOnClick, onClick, ...props }: any) {
    return (
      <button {...props} onClick={onClick}>
        {children}
      </button>
    )
  },
  DropdownMenuSeparator: function MockDropdownMenuSeparator() {
    return <hr />
  },
  DropdownMenuTrigger: function MockDropdownMenuTrigger({ children, render }: any) {
    return render ? <button {...render.props}>{children}</button> : <>{children}</>
  },
}))

void mock.module('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => mocks.useSiteIdentity(),
}))

void mock.module('@/lib/affiliate-data', () => ({
  fetchAffiliateSettingsFromAPI: () => mocks.fetchAffiliateSettingsFromAPI(),
}))

void mock.module('@/lib/affiliate-toast', () => ({
  maybeShowAffiliateToast: (...args: any[]) => mocks.maybeShowAffiliateToast(...args),
}))

void mock.module('@/lib/events-routing', () => ({
  resolveEventMarketPath: (...args: any[]) => mocks.resolveEventMarketPath(...args),
  resolveEventPagePath: (...args: any[]) => mocks.resolveEventPagePath(...args),
}))

void mock.module('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

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
    end_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    main_tag: 'trending',
    is_bookmarked: false,
    is_trending: false,
    tags: [],
    markets: [
      {
        id: 'market-1',
        slug: 'market-1',
        title: 'Market 1',
        condition_id: 'condition-1',
        question_id: 'question-1',
        volume: 0,
        volume24: 0,
        liquidity: 0,
        order_price_min_tick_size: 1,
        order_min_size: 1,
        orderbook: false,
        featured: false,
        archived: false,
        closed: false,
        active: true,
        enable_order_book: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        outcomes: [],
      } as any,
    ],
    ...overrides,
  }
}

function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: resolvePromise,
  }
}

function renderWithQueryClient(component: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>)
}

describe('eventShare', () => {
  const writeText = mock()

  beforeEach(() => {
    mocks.fetchAffiliateSettingsFromAPI.mockReset()
    mocks.maybeShowAffiliateToast.mockReset()
    mocks.resolveEventMarketPath.mockReset()
    mocks.resolveEventPagePath.mockReset()
    mocks.useSiteIdentity.mockReset()
    mocks.useUser.mockReset()

    writeText.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    mocks.useSiteIdentity.mockReturnValue({ name: 'Kuest' })
    mocks.useUser.mockReturnValue({ affiliate_code: 'abc123' })
    mocks.resolveEventPagePath.mockReturnValue('/event/event-1')
    mocks.resolveEventMarketPath.mockReturnValue('/event/event-1/market-1')
  })

  it('loads affiliate settings when a single-market share is clicked and shows the toast with fetched values', async () => {
    mocks.useUser.mockReturnValue({ username: 'alice', affiliate_code: 'abc123' })
    mocks.fetchAffiliateSettingsFromAPI.mockResolvedValue({
      success: true,
      data: {
        builderTakerSharePercent: '30.00',
        builderMakerFlatFeePercent: '0.00',
        affiliateSharePercent: '40.00',
        operatorSharePercent: '60.00',
        builderTakerShareDecimal: 0.3,
        builderMakerFlatFeeDecimal: 0,
        affiliateShareDecimal: 0.4,
        operatorShareDecimal: 0.6,
      },
    })

    renderWithQueryClient(<EventShare event={createEvent()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy event link' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('http://localhost:3000/event/event-1?r=alice')
    })

    await waitFor(() => {
      expect(mocks.fetchAffiliateSettingsFromAPI).toHaveBeenCalledTimes(1)
      expect(mocks.maybeShowAffiliateToast).toHaveBeenCalledWith({
        affiliateCode: 'alice',
        affiliateSharePercent: 40,
        builderTakerSharePercent: 30,
        siteName: 'Kuest',
        context: 'link',
      })
    })
  })

  it('does not refetch affiliate settings after a resolved 0% response', async () => {
    mocks.fetchAffiliateSettingsFromAPI.mockResolvedValue({
      success: true,
      data: {
        builderTakerSharePercent: '0.00',
        builderMakerFlatFeePercent: '0.00',
        affiliateSharePercent: '0.00',
        operatorSharePercent: '100.00',
        builderTakerShareDecimal: 0,
        builderMakerFlatFeeDecimal: 0,
        affiliateShareDecimal: 0,
        operatorShareDecimal: 1,
      },
    })

    renderWithQueryClient(<EventShare event={createEvent()} />)

    const shareButton = screen.getByRole('button', { name: 'Copy event link' })

    await userEvent.click(shareButton)
    await userEvent.click(shareButton)

    await waitFor(() => {
      expect(mocks.fetchAffiliateSettingsFromAPI).toHaveBeenCalledTimes(1)
    })
  })

  it('retries affiliate settings after a failed response', async () => {
    const firstResponse = createDeferredPromise<{
      success: false
      error: {
        error: string
      }
    }>()

    mocks.fetchAffiliateSettingsFromAPI.mockReturnValueOnce(firstResponse.promise).mockResolvedValueOnce({
      success: true,
      data: {
        builderTakerSharePercent: '30.00',
        builderMakerFlatFeePercent: '0.00',
        affiliateSharePercent: '40.00',
        operatorSharePercent: '60.00',
        builderTakerShareDecimal: 0.3,
        builderMakerFlatFeeDecimal: 0,
        affiliateShareDecimal: 0.4,
        operatorShareDecimal: 0.6,
      },
    })

    renderWithQueryClient(<EventShare event={createEvent()} />)

    const shareButton = screen.getByRole('button', { name: 'Copy event link' })

    await userEvent.click(shareButton)

    await waitFor(() => {
      expect(mocks.fetchAffiliateSettingsFromAPI).toHaveBeenCalledTimes(1)
    })

    firstResponse.resolve({
      success: false,
      error: {
        error: 'Internal server error',
      },
    })

    await waitFor(() => {
      expect(mocks.maybeShowAffiliateToast).toHaveBeenNthCalledWith(1, {
        affiliateCode: 'abc123',
        affiliateSharePercent: null,
        builderTakerSharePercent: null,
        siteName: 'Kuest',
        context: 'link',
      })
    })

    await userEvent.click(shareButton)

    await waitFor(() => {
      expect(mocks.fetchAffiliateSettingsFromAPI).toHaveBeenCalledTimes(2)
      expect(mocks.maybeShowAffiliateToast).toHaveBeenNthCalledWith(2, {
        affiliateCode: 'abc123',
        affiliateSharePercent: 40,
        builderTakerSharePercent: 30,
        siteName: 'Kuest',
        context: 'link',
      })
    })
  })

  it('does not open the hover menu for touch input', () => {
    renderWithQueryClient(<EventShare event={createEvent({ total_markets_count: 2 })} />)

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Copy event link' }), { pointerType: 'touch' })

    expect(screen.getByTestId('share-menu')).toHaveAttribute('data-state', 'closed')
  })

  it('copies a multi-market link and closes the menu', async () => {
    renderWithQueryClient(<EventShare event={createEvent({ total_markets_count: 2 })} />)

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Copy event link' }), { pointerType: 'mouse' })
    expect(screen.getByTestId('share-menu')).toHaveAttribute('data-state', 'open')

    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('http://localhost:3000/event/event-1?r=abc123')
    })
    expect(screen.getByTestId('share-menu')).toHaveAttribute('data-state', 'closed')
  })

  it('groups multi-market links by resolution and sorts each group by end time', () => {
    const event = createEvent({
      total_markets_count: 4,
      markets: [
        {
          ...createEvent().markets[0],
          id: 'market-resolved-later',
          slug: 'resolved-later',
          condition_id: 'condition-resolved-later',
          title: 'Resolved later',
          end_time: '2026-09-06T12:00:00.000Z',
          is_resolved: true,
        },
        {
          ...createEvent().markets[0],
          id: 'market-active-later',
          slug: 'active-later',
          condition_id: 'condition-active-later',
          title: 'Active later',
          end_time: '2026-09-05T12:00:00.000Z',
        },
        {
          ...createEvent().markets[0],
          id: 'market-active-sooner',
          slug: 'active-sooner',
          condition_id: 'condition-active-sooner',
          title: 'Active sooner',
          end_time: '2026-09-04T12:00:00.000Z',
        },
        {
          ...createEvent().markets[0],
          id: 'market-resolved-sooner',
          slug: 'resolved-sooner',
          condition_id: 'condition-resolved-sooner',
          title: 'Resolved sooner',
          end_time: '2026-09-03T12:00:00.000Z',
          is_resolved: true,
        },
      ] as any,
    })

    renderWithQueryClient(<EventShare event={event} />)

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Copy event link' }), { pointerType: 'mouse' })

    const menuItems = screen
      .getAllByRole('button')
      .filter((button) => button.textContent)
      .map((button) => button.textContent)

    expect(menuItems).toEqual(['Copy link', 'Active sooner', 'Active later', 'Resolved sooner', 'Resolved later'])
    expect(document.querySelectorAll('hr')).toHaveLength(2)
    expect(document.querySelector('.max-h-56')).toHaveClass('p-1', 'overscroll-contain')
    expect(screen.getByRole('button', { name: 'Active sooner' })).toHaveClass('py-2')
  })

  it('closes an open multi-market menu when the page scrolls', () => {
    renderWithQueryClient(<EventShare event={createEvent({ total_markets_count: 2 })} />)

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Copy event link' }), { pointerType: 'mouse' })
    fireEvent.scroll(window)

    expect(screen.getByTestId('share-menu')).toHaveAttribute('data-state', 'closed')
  })

  it('keeps an open multi-market menu open when its contents scroll', () => {
    renderWithQueryClient(<EventShare event={createEvent({ total_markets_count: 2 })} />)

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Copy event link' }), { pointerType: 'mouse' })
    fireEvent.scroll(screen.getByRole('button', { name: 'Copy link' }))

    expect(screen.getByTestId('share-menu')).toHaveAttribute('data-state', 'open')
  })
})
