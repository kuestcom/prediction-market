import { fireEvent, render, screen } from '@testing-library/react'
import PublicPositionsFilters from '@/app/[locale]/(platform)/profile/_components/PublicPositionsFilters'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

describe('publicPositionsFilters', () => {
  it('shows the selected status and forwards status changes', () => {
    const onMarketStatusChange = vi.fn()

    render(
      <PublicPositionsFilters
        searchQuery=""
        sortBy="currentValue"
        marketStatusFilter="active"
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onMarketStatusChange={onMarketStatusChange}
        showMergeButton={false}
        onMergeClick={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Closed' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Closed' }))

    expect(onMarketStatusChange).toHaveBeenCalledWith('closed')
  })
})
