import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import PublicPositionsTable from '@/app/[locale]/(platform)/profile/_components/PublicPositionsTable'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/app/[locale]/(platform)/profile/_components/PublicClosedPositionsRow', () => ({
  default: () => null,
}))

vi.mock('@/app/[locale]/(platform)/profile/_components/PublicPositionsRow', () => ({
  default: () => null,
}))

describe('publicPositionsTable', () => {
  it('shows closed-position columns instead of active-position columns', () => {
    const onSortHeaderClick = vi.fn()

    render(
      <PublicPositionsTable
        positions={[]}
        totals={{ trade: 0, value: 0, diff: 0, pct: 0, toWin: 0 }}
        isLoading={false}
        hasInitialError={false}
        isSearchActive={false}
        searchQuery=""
        retryCount={0}
        marketStatusFilter="closed"
        sortBy="currentValue"
        sortDirection="desc"
        onSortHeaderClick={onSortHeaderClick}
        onRetry={() => {}}
        onRefreshPage={() => {}}
        onShareClick={() => {}}
        loadMoreRef={createRef<HTMLDivElement>()}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Result' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Total Traded' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Amount Won' })).toBeVisible()
    expect(screen.queryByRole('columnheader', { name: 'Avg → Now' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Amount Won' }))
    expect(onSortHeaderClick).toHaveBeenCalledWith('currentValue')
  })
})
