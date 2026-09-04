import type { ReactNode } from 'react'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, mock } from 'bun:test'

import AdminCategoriesTable from '@/app/[locale]/admin/categories/_components/AdminCategoriesTable'

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mock(),
    setQueriesData: mock(),
  }),
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

void mock.module('@/app/[locale]/admin/categories/_hooks/useAdminCategories', () => ({
  useAdminCategoriesTable: () => ({
    categories: [],
    totalCount: 0,
    isLoading: false,
    error: null,
    retry: mock(),
    search: '',
    handleSearchChange: mock(),
    sortBy: 'display_order',
    sortOrder: 'asc',
    mainOnly: false,
    handleSortChange: mock(),
    handleMainOnlyChange: mock(),
    pageIndex: 0,
    pageSize: 10,
    handlePageChange: mock(),
    handlePageSizeChange: mock(),
  }),
}))

void mock.module('@/app/[locale]/admin/categories/_components/columns', () => ({
  useAdminCategoryColumns: () => [],
}))

void mock.module('@/app/[locale]/admin/_components/DataTable', () => ({
  DataTable: ({
    aboveTableContent,
    toolbarRightContent,
  }: {
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

void mock.module('@/app/[locale]/admin/categories/_components/MainCategorySortDialog', () => ({
  default: () => null,
}))

void mock.module('@/app/[locale]/admin/categories/_components/SportsSidebarCategoriesManager', () => ({
  default: ({ open, vertical = 'sports' }: { open: boolean; vertical?: string }) =>
    open ? <div>{vertical === 'esports' ? 'Esports manager open' : 'Sports manager open'}</div> : null,
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
    expect(
      within(screen.getByTestId('above-table-content')).getByRole('button', {
        name: 'Manage sports sidebar',
      }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('above-table-content')).getByRole('button', {
        name: 'Manage esports sidebar',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage sports sidebar' }))

    expect(screen.getByText('Sports manager open')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage esports sidebar' }))

    expect(screen.getByText('Esports manager open')).toBeInTheDocument()
  })
})
