import type { Event } from '@/types'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EventShare from '@/app/[locale]/(platform)/event/[slug]/_components/EventShare'

const mocks = vi.hoisted(() => ({
  fetchAffiliateSettingsFromAPI: vi.fn(),
  maybeShowAffiliateToast: vi.fn(),
  resolveEventMarketPath: vi.fn(),
  resolveEventPagePath: vi.fn(),
  useSiteIdentity: vi.fn(),
  useUser: vi.fn(),
}))

vi.mock('@/components/ui/button', () => ({
  Button: function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: function MockDropdownMenu({ children }: any) {
    return <div>{children}</div>
  },
  DropdownMenuContent: function MockDropdownMenuContent({ children }: any) {
    return <div>{children}</div>
  },
  DropdownMenuItem: function MockDropdownMenuItem({ children, onSelect, ...props }: any) {
    return (
      <button
        {...props}
        onClick={() => onSelect?.({ preventDefault() {} })}
      >
        {children}
      </button>
    )
  },
  DropdownMenuSeparator: function MockDropdownMenuSeparator() {
    return <hr />
  },
  DropdownMenuTrigger: function MockDropdownMenuTrigger({ children }: any) {
    return <>{children}</>
  },
}))

vi.mock('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => mocks.useSiteIdentity(),
}))

vi.mock('@/lib/affiliate-data', () => ({
  fetchAffiliateSettingsFromAPI: () => mocks.fetchAffiliateSettingsFromAPI(),
}))

vi.mock('@/lib/affiliate-toast', () => ({
  maybeShowAffiliateToast: (...args: any[]) => mocks.maybeShowAffiliateToast(...args),
}))

vi.mock('@/lib/events-routing', () => ({
  resolveEventMarketPath: (...args: any[]) => mocks.resolveEventMarketPath(...args),
  resolveEventPagePath: (...args: any[]) => mocks.resolveEventPagePath(...args),
}))

vi.mock('@/stores/useUser', () => ({
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

describe('eventShare', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    mocks.fetchAffiliateSettingsFromAPI.mockReset()
    mocks.maybeShowAffiliateToast.mockReset()
    mocks.resolveEventMarketPath.mockReset()
    mocks.resolveEventPagePath.mockReset()
    mocks.useSiteIdentity.mockReset()
    mocks.useUser.mockReset()

    writeText.mockReset()
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })

    mocks.useSiteIdentity.mockReturnValue({ name: 'Kuest' })
    mocks.useUser.mockReturnValue({ affiliate_code: 'abc123' })
    mocks.resolveEventPagePath.mockReturnValue('/event/event-1')
    mocks.resolveEventMarketPath.mockReturnValue('/event/event-1/market-1')
  })

  it('loads affiliate settings when a single-market share is clicked and shows the toast with fetched values', async () => {
    mocks.fetchAffiliateSettingsFromAPI.mockResolvedValue({
      success: true,
      data: {
        tradeFeePercent: '1.00',
        affiliateSharePercent: '40.00',
        platformSharePercent: '60.00',
        tradeFeeDecimal: 0.01,
        affiliateShareDecimal: 0.4,
        platformShareDecimal: 0.6,
      },
    })

    render(<EventShare event={createEvent()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy event link' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('http://localhost:3000/event/event-1?r=abc123')
    })

    await waitFor(() => {
      expect(mocks.fetchAffiliateSettingsFromAPI).toHaveBeenCalledTimes(1)
      expect(mocks.maybeShowAffiliateToast).toHaveBeenCalledWith({
        affiliateCode: 'abc123',
        affiliateSharePercent: 40,
        tradeFeePercent: 1,
        siteName: 'Kuest',
        context: 'link',
      })
    })
  })

  it('does not refetch affiliate settings after a resolved 0% response', async () => {
    mocks.fetchAffiliateSettingsFromAPI.mockResolvedValue({
      success: true,
      data: {
        tradeFeePercent: '0.00',
        affiliateSharePercent: '0.00',
        platformSharePercent: '100.00',
        tradeFeeDecimal: 0,
        affiliateShareDecimal: 0,
        platformShareDecimal: 1,
      },
    })

    render(<EventShare event={createEvent()} />)

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

    mocks.fetchAffiliateSettingsFromAPI
      .mockReturnValueOnce(firstResponse.promise)
      .mockResolvedValueOnce({
        success: true,
        data: {
          tradeFeePercent: '1.00',
          affiliateSharePercent: '40.00',
          platformSharePercent: '60.00',
          tradeFeeDecimal: 0.01,
          affiliateShareDecimal: 0.4,
          platformShareDecimal: 0.6,
        },
      })

    render(<EventShare event={createEvent()} />)

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
      expect(mocks.maybeShowAffiliateToast).toHaveBeenCalledTimes(1)
    })

    await userEvent.click(shareButton)

    await waitFor(() => {
      expect(mocks.fetchAffiliateSettingsFromAPI).toHaveBeenCalledTimes(2)
      expect(mocks.maybeShowAffiliateToast).toHaveBeenCalledWith({
        affiliateCode: 'abc123',
        affiliateSharePercent: 40,
        tradeFeePercent: 1,
        siteName: 'Kuest',
        context: 'link',
      })
    })
  })
})
