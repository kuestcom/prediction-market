import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import PublicPositionsFilters from '@/app/[locale]/(platform)/profile/_components/PublicPositionsFilters'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
  SelectTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" role="combobox" {...props}>{children}</button>
  ),
  SelectValue: () => null,
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

  it('labels closed amount-won and P&L sorts distinctly', () => {
    render(
      <PublicPositionsFilters
        searchQuery=""
        sortBy="currentValue"
        marketStatusFilter="closed"
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onMarketStatusChange={() => {}}
        showMergeButton={false}
        onMergeClick={() => {}}
      />,
    )

    expect(screen.getByRole('option', { name: 'Amount Won' })).toBeVisible()
    expect(screen.getAllByRole('option', { name: 'Profit & Loss $' })).toHaveLength(1)
  })
})
