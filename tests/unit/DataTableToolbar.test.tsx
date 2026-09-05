import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import type { DataTableInstance } from '@/lib/data-table'

import { useFakeTimers, useRealTimers } from '../bun-test-helpers'

void mock.module('next-intl', () => ({
  useExtracted: () => (key: string, values?: Record<string, string>) => {
    if (!values) {
      return key
    }

    return Object.entries(values).reduce((acc, [name, value]) => acc.replace(`{${name}}`, String(value)), key)
  },
}))

const { DataTableToolbar } = await import('@/app/[locale]/admin/_components/DataTableToolbar')

function createTableStub() {
  return {
    getFilteredSelectedRowModel: () => ({ rows: [] }),
    getFilteredRowModel: () => ({ rows: [] }),
  } as unknown as DataTableInstance<Record<string, unknown>>
}

function getSearchInput() {
  const [input] = screen.getAllByPlaceholderText('Search...')
  return input
}

describe('dataTableToolbar', () => {
  beforeEach(() => {
    useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    useRealTimers()
  })

  it('does not emit a stale debounced search after an external override', () => {
    const table = createTableStub()
    const onSearchChange = mock()

    const { rerender } = render(
      <DataTableToolbar table={table} search="alpha" onSearchChange={onSearchChange} enableColumnVisibility={false} />,
    )

    fireEvent.change(getSearchInput(), { target: { value: 'alphamax' } })

    act(() => {
      rerender(
        <DataTableToolbar table={table} search="beta" onSearchChange={onSearchChange} enableColumnVisibility={false} />,
      )
    })

    expect(onSearchChange).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(onSearchChange).not.toHaveBeenCalled()
  })

  it('still emits debounced user input after an external search sync', () => {
    const table = createTableStub()
    const onSearchChange = mock()

    const { rerender } = render(
      <DataTableToolbar table={table} search="alpha" onSearchChange={onSearchChange} enableColumnVisibility={false} />,
    )

    act(() => {
      rerender(
        <DataTableToolbar table={table} search="beta" onSearchChange={onSearchChange} enableColumnVisibility={false} />,
      )
    })

    fireEvent.change(getSearchInput(), { target: { value: 'betamax' } })

    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(onSearchChange).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith('betamax')
  })
})
