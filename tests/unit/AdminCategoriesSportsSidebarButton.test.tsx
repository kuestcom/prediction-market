import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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
  DataTable: ({ toolbarRightContent }: { toolbarRightContent: ReactNode }) => (
    <div>{toolbarRightContent}</div>
  ),
}))

vi.mock('@/app/[locale]/admin/categories/_components/MainCategorySortDialog', () => ({
  default: () => null,
}))

vi.mock('@/app/[locale]/admin/categories/_components/SportsSidebarCategoriesManager', () => ({
  default: ({ open }: { open: boolean }) => open ? <div>Sports manager open</div> : null,
}))

describe('admin categories sports sidebar button', () => {
  it('opens the sports sidebar manager from the categories toolbar', () => {
    render(<AdminCategoriesTable />)

    fireEvent.click(screen.getByRole('button', { name: 'Manage sports sidebar' }))

    expect(screen.getByText('Sports manager open')).toBeInTheDocument()
  })
})
