import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import PublicPositionsFilters from '@/app/[locale]/(platform)/profile/_components/PublicPositionsFilters'

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

void mock.module('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ alignItemWithTrigger, children }: { alignItemWithTrigger?: boolean; children: ReactNode }) => (
    <div data-testid="select-content" data-align-item-with-trigger={String(alignItemWithTrigger)}>
      {children}
    </div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
  SelectTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" role="combobox" {...props}>
      {children}
    </button>
  ),
  SelectValue: () => null,
}))

describe('publicPositionsFilters', () => {
  it('shows the selected status and forwards status changes', () => {
    const onMarketStatusChange = mock()

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
    expect(screen.getByTestId('select-content')).toHaveAttribute('data-align-item-with-trigger', 'false')

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
