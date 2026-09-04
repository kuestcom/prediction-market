import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import type { DataTableColumnDef } from '@/lib/data-table'

void mock.module('next-intl', () => ({
  useExtracted: () => (key: string, values?: Record<string, string>) => {
    if (!values) {
      return key
    }

    return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), key)
  },
}))

const { DataTable } = await import('@/app/[locale]/admin/_components/DataTable')

interface TestRow {
  id: string
  name: string
}

const columns: DataTableColumnDef<TestRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Name
      </button>
    ),
    cell: ({ row }) => row.original.name,
  },
]

describe('dataTable', () => {
  it('renders rows and forwards v9 sorting changes', () => {
    const onSortChange = mock()

    render(
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'Alpha' }]}
        totalCount={1}
        search=""
        onSearchChange={mock()}
        sortBy={null}
        sortOrder={null}
        onSortChange={onSortChange}
        pageIndex={0}
        pageSize={10}
        onPageChange={mock()}
        onPageSizeChange={mock()}
        enableColumnVisibility={false}
        enablePagination={false}
      />,
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Name' }))

    expect(onSortChange).toHaveBeenCalledWith('name', 'asc')
  })
})
