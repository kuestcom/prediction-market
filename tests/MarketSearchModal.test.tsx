import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketSearchModal } from '@/components/market-search/MarketSearchModal'

import { useMarketSearch } from '@/hooks/useMarketSearch'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/hooks/useMarketSearch', () => ({
  useMarketSearch: vi.fn(),
}))

const MOCK_RESULTS = [
  {
    id: '1',
    slug: 'will-btc-100k',
    question: 'Will BTC hit $100k?',
    probability: 0.72,
    closeTime: '2025-12-31T00:00:00Z',
    volumeUsdc: 500000,
    active: true,
  },
  {
    id: '2',
    slug: 'will-eth-flip',
    question: 'Will ETH flip BTC?',
    probability: 0.18,
    closeTime: '2025-06-30T00:00:00Z',
    volumeUsdc: 120000,
    active: true,
  },
]

function setupMock(overrides = {}) {
  (useMarketSearch as ReturnType<typeof vi.fn>).mockReturnValue({
    results: [],
    isLoading: false,
    error: null,
    clear: vi.fn(),
    ...overrides,
  })
}

describe('marketSearchModal', () => {
  beforeEach(() => {
    setupMock()
    mockPush.mockClear()
  })

  it('does not render the dialog when closed', () => {
    render(<MarketSearchModal open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog and input when open', async () => {
    render(<MarketSearchModal open onOpenChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders results from the hook', async () => {
    setupMock({ results: MOCK_RESULTS })
    render(<MarketSearchModal open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Will BTC hit $100k?')).toBeInTheDocument()
      expect(screen.getByText('Will ETH flip BTC?')).toBeInTheDocument()
    })
  })

  it('navigates on result click', async () => {
    setupMock({ results: MOCK_RESULTS })
    render(<MarketSearchModal open onOpenChange={vi.fn()} />)

    await waitFor(() => screen.getByText('Will BTC hit $100k?'))
    fireEvent.click(screen.getByText('Will BTC hit $100k?'))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/markets/will-btc-100k'),
    )
  })

  it('navigates via keyboard Enter on active result', async () => {
    const user = userEvent.setup({ delay: null })
    setupMock({ results: MOCK_RESULTS })
    render(<MarketSearchModal open onOpenChange={vi.fn()} />)

    await waitFor(() => screen.getByRole('dialog'))
    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/markets/will-btc-100k'),
    )
  })

  it('shows error message from the hook', async () => {
    setupMock({ error: 'Search failed. Please try again.' })
    render(<MarketSearchModal open onOpenChange={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText('Search failed. Please try again.')).toBeInTheDocument(),
    )
  })
})
