import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminCategoriesTable from '@/app/[locale]/admin/categories/_components/AdminCategoriesTable'

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueriesData: vi.fn(),
  }),
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/app/[locale]/admin/categories/_hooks/useAdminCategories', () => ({
  useAdminCategoriesTable: () => ({
    categories: [],
    totalCount: 0,
    isLoading: false,
    error: null,
    retry: vi.fn(),
    search: '',
    handleSearchChange: vi.fn(),
    sortBy: 'display_order',
    sortOrder: 'asc',
    mainOnly: false,
    handleSortChange: vi.fn(),
    handleMainOnlyChange: vi.fn(),
    pageIndex: 0,
    pageSize: 10,
    handlePageChange: vi.fn(),
    handlePageSizeChange: vi.fn(),
  }),
}))

vi.mock('@/app/[locale]/admin/categories/_components/columns', () => ({
  useAdminCategoryColumns: () => [],
}))

vi.mock('@/app/[locale]/admin/_components/DataTable', () => ({
  DataTable: ({ aboveTableContent, toolbarRightContent }: {
    aboveTableContent: ReactNode
    toolbarRightContent: ReactNode
  }) => (
    <div>
      <div>{toolbarRightContent}</div>
      <div data-testid="above-table-content">{aboveTableContent}</div>
      <div>Categories table</div>
    </div>
  ),
}))

vi.mock('@/app/[locale]/admin/categories/_components/MainCategorySortDialog', () => ({
  default: () => null,
}))

vi.mock('@/app/[locale]/admin/categories/_components/SportsSidebarCategoriesManager', () => ({
  default: ({ open, vertical = 'sports' }: { open: boolean, vertical?: string }) => open
    ? <div>{vertical === 'esports' ? 'Esports manager open' : 'Sports manager open'}</div>
    : null,
}))

describe('admin categories sports sidebar button', () => {
  it('reveals the sports and esports sidebar actions above the table and opens their managers', async () => {
    const user = userEvent.setup()
    render(<AdminCategoriesTable />)

    const actionsButton = screen.getByRole('button', { name: 'Actions' })
    expect(actionsButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Manage sports sidebar' })).not.toBeInTheDocument()

    await user.click(actionsButton)

    expect(actionsButton).toHaveAttribute('aria-expanded', 'true')
    expect(within(screen.getByTestId('above-table-content')).getByRole('button', {
      name: 'Manage sports sidebar',
    })).toBeInTheDocument()
    expect(within(screen.getByTestId('above-table-content')).getByRole('button', {
      name: 'Manage esports sidebar',
    })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage sports sidebar' }))

    expect(screen.getByText('Sports manager open')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage esports sidebar' }))

    expect(screen.getByText('Esports manager open')).toBeInTheDocument()
  })
})
