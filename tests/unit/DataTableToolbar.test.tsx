import type { Table } from '@tanstack/react-table'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useExtracted: () => (key: string, values?: Record<string, string>) => {
    if (!values) {
      return key
    }

    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
      key,
    )
  },
}))

const { DataTableToolbar } = await import('@/app/[locale]/admin/_components/DataTableToolbar')

function createTableStub() {
  return {
    getFilteredSelectedRowModel: () => ({ rows: [] }),
    getFilteredRowModel: () => ({ rows: [] }),
  } as unknown as Table<unknown>
}

describe('dataTableToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
  })

  it('does not emit a stale search value when search prop changes externally', () => {
    const table = createTableStub()
    const onSearchChange = vi.fn()

    const { rerender } = render(
      <DataTableToolbar
        table={table}
        search="alpha"
        onSearchChange={onSearchChange}
        enableColumnVisibility={false}
      />,
    )

    act(() => {
      rerender(
        <DataTableToolbar
          table={table}
          search="beta"
          onSearchChange={onSearchChange}
          enableColumnVisibility={false}
        />,
      )
    })

    expect(onSearchChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onSearchChange).not.toHaveBeenCalled()
  })

  it('still emits debounced user input after an external search sync', () => {
    const table = createTableStub()
    const onSearchChange = vi.fn()

    const { rerender } = render(
      <DataTableToolbar
        table={table}
        search="alpha"
        onSearchChange={onSearchChange}
        enableColumnVisibility={false}
      />,
    )

    act(() => {
      rerender(
        <DataTableToolbar
          table={table}
          search="beta"
          onSearchChange={onSearchChange}
          enableColumnVisibility={false}
        />,
      )
    })

    const [input] = screen.getAllByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'betamax' } })

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(onSearchChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith('betamax')
  })
})
