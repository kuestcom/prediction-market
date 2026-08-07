import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminResolutionReportsDialog from '@/app/[locale]/admin/events/_components/AdminResolutionReportsDialog'

const mocks = vi.hoisted(() => ({
  fetchNextPage: vi.fn(),
  useInfiniteQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => mocks.useInfiniteQuery(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: any) => <span role="img" aria-label={alt} />,
}))

vi.mock('@/components/EventIconImage', () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, nativeButton: _nativeButton, render, ...props }: any) =>
    render ?? <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <span>{children}</span>,
  TooltipTrigger: ({ render }: any) => render,
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const event = {
  id: 'event-1',
  slug: 'event-slug',
  title: 'Event title',
  icon_url: '',
  resolution_report_count: 75,
} as never

const report = {
  id: 'report-1',
  conditionId: 'condition-1',
  marketTitle: 'Market title',
  marketIconUrl: '',
  outcome: 'yes',
  outcomeLabel: 'Yes',
  reporterProfileSlug: 'reporter',
  reporterUsername: 'Reporter',
  reporterImage: '',
  historyCorrectCount: 0,
  historyIncorrectCount: 0,
  signedAt: '2026-08-02T12:00:00.000Z',
}

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      pages: [{ reports: [report], totalCount: 75, marketReportCounts: { 'condition-1': 2 }, nextOffset: 50 }],
    },
    fetchNextPage: mocks.fetchNextPage,
    hasNextPage: true,
    isError: false,
    isFetchNextPageError: false,
    isFetchingNextPage: false,
    isLoading: false,
    ...overrides,
  }
}

describe('AdminResolutionReportsDialog', () => {
  beforeEach(() => {
    mocks.fetchNextPage.mockReset()
    mocks.useInfiniteQuery.mockReset()
  })

  it('keeps each market proposal count exact while other pages remain', () => {
    mocks.useInfiniteQuery.mockReturnValue(queryResult())

    render(<AdminResolutionReportsDialog event={event} onClose={vi.fn()} />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('1+')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('uses one event and market hierarchy instead of a duplicated event summary', () => {
    mocks.useInfiniteQuery.mockReturnValue(queryResult({ hasNextPage: false }))

    render(<AdminResolutionReportsDialog event={event} onClose={vi.fn()} />)

    expect(screen.getAllByText('Event title')).toHaveLength(1)
    expect(screen.getByText('Market title')).toHaveClass('text-muted-foreground')
  })

  it('shows an exact market proposal count after the final page', () => {
    mocks.useInfiniteQuery.mockReturnValue(queryResult({ hasNextPage: false }))

    render(<AdminResolutionReportsDialog event={event} onClose={vi.fn()} />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('1+')).not.toBeInTheDocument()
  })

  it('keeps loaded reports visible and offers retry after a next-page error', () => {
    mocks.useInfiniteQuery.mockReturnValue(
      queryResult({
        isError: true,
        isFetchNextPageError: true,
      }),
    )

    render(<AdminResolutionReportsDialog event={event} onClose={vi.fn()} />)

    expect(screen.getByText('Reporter')).toBeInTheDocument()
    expect(screen.getByText('Could not load resolution reports.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.fetchNextPage).toHaveBeenCalledOnce()
  })

  it('shows the reporter onchain resolution history', () => {
    mocks.useInfiniteQuery.mockReturnValue(
      queryResult({
        data: {
          pages: [
            {
              reports: [{ ...report, historyCorrectCount: 7, historyIncorrectCount: 2 }],
              totalCount: 1,
              nextOffset: null,
            },
          ],
        },
        hasNextPage: false,
      }),
    )

    render(<AdminResolutionReportsDialog event={event} onClose={vi.fn()} />)

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Proposal history: {correct} correct and {incorrect} incorrect.')).toBeInTheDocument()
  })

  it('identifies the reporter in the avatar profile link', () => {
    mocks.useInfiniteQuery.mockReturnValue(queryResult({ hasNextPage: false }))

    render(<AdminResolutionReportsDialog event={event} onClose={vi.fn()} />)

    expect(screen.getByRole('link', { name: 'Reporter — Profile' })).toHaveAttribute('href', '/@reporter')
  })
})
