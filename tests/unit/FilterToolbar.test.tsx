import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, mock, jest } from 'bun:test'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'

import FilterToolbar from '@/app/[locale]/(platform)/(home)/_components/FilterToolbar'

import { hoisted, useFakeTimers, useRealTimers } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  open: mock(),
}))

void mock.module('@reown/appkit/react', () => ({
  useAppKitAccount: () => ({ isConnected: true }),
}))

void mock.module('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: mocks.open }),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

const FILTERS = {
  tag: 'trending',
  mainTag: 'trending',
  search: '',
  bookmarked: false,
  frequency: 'all',
  sortBy: 'volume_24h',
  status: 'active',
  hideSports: false,
  hideCrypto: false,
  hideEarnings: false,
} as const satisfies FilterState

describe('filterToolbar', () => {
  it('loads settings controls only after the settings toggle opens', async () => {
    const onFiltersChange = mock()

    render(<FilterToolbar filters={FILTERS} onFiltersChange={onFiltersChange} />)

    expect(screen.queryByRole('combobox', { name: 'Sort by:' })).not.toBeInTheDocument()

    const settingsTrigger = screen.getByRole('button', { name: 'Open filters' })
    expect(settingsTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(settingsTrigger).not.toHaveAttribute('aria-pressed')

    fireEvent.click(settingsTrigger)

    expect(settingsTrigger).toHaveAttribute('aria-expanded', 'true')

    const sortControls = await screen.findAllByRole('combobox', { name: 'Sort by:' })
    expect(sortControls[0]).toHaveTextContent('24h Volume')

    const hideSportsCheckboxes = await screen.findAllByRole('checkbox', { name: 'Hide sports?' })
    fireEvent.click(hideSportsCheckboxes[0])

    expect(onFiltersChange).toHaveBeenCalledWith({ hideSports: true })
  })

  it('collapses the search input behind an icon button when requested', () => {
    const onFiltersChange = mock()

    render(<FilterToolbar collapsibleSearch filters={FILTERS} onFiltersChange={onFiltersChange} />)

    expect(screen.queryByTestId('filter-search-input')).not.toBeInTheDocument()

    const searchTrigger = screen.getByRole('button', { name: 'Open search' })
    expect(searchTrigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(searchTrigger)

    expect(screen.getByTestId('filter-search-input')).toBeVisible()
    expect(screen.queryByTestId('filter-search-trigger')).not.toBeInTheDocument()
  })

  it('closes the expanded empty search input when clicking outside', () => {
    const onFiltersChange = mock()

    render(<FilterToolbar collapsibleSearch filters={FILTERS} onFiltersChange={onFiltersChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    expect(screen.getByTestId('filter-search-input')).toBeVisible()

    fireEvent.pointerDown(document.body)

    expect(screen.getByTestId('filter-search-input')).toBeVisible()

    fireEvent.click(document.body)

    expect(screen.queryByTestId('filter-search-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-search-trigger')).toBeVisible()
    expect(document.activeElement).toBe(screen.getByTestId('filter-search-trigger'))
  })

  it('clears a typed query before closing the search with Escape', () => {
    const onFiltersChange = mock()

    render(<FilterToolbar collapsibleSearch filters={FILTERS} onFiltersChange={onFiltersChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    const searchInput = screen.getByTestId('filter-search-input')

    fireEvent.change(searchInput, { target: { value: 'bitcoin' } })
    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(screen.getByTestId('filter-search-input')).toBeVisible()
    expect(searchInput).toHaveValue('')
    expect(onFiltersChange).toHaveBeenCalledWith({ search: '' })

    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(screen.queryByTestId('filter-search-input')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByTestId('filter-search-trigger'))
  })

  it('commits an emptied non-collapsible search when Escape is pressed', () => {
    const onFiltersChange = mock()
    const filters = { ...FILTERS, search: 'bitcoin' }

    render(<FilterToolbar filters={filters} onFiltersChange={onFiltersChange} />)

    const searchInput = screen.getByTestId('filter-search-input')
    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(searchInput).toHaveValue('')
    expect(onFiltersChange).toHaveBeenCalledWith({ search: '' })
  })

  it('does not cancel a non-collapsible search debounce when Escape is pressed with text', async () => {
    useFakeTimers()
    const onFiltersChange = mock()

    try {
      render(<FilterToolbar filters={FILTERS} onFiltersChange={onFiltersChange} />)

      const searchInput = screen.getByTestId('filter-search-input')
      fireEvent.change(searchInput, { target: { value: 'bitcoin' } })
      fireEvent.keyDown(searchInput, { key: 'Escape' })

      expect(onFiltersChange).not.toHaveBeenCalled()

      await act(() => jest.advanceTimersByTime(150))

      expect(onFiltersChange).toHaveBeenCalledWith({ search: 'bitcoin' })
    } finally {
      useRealTimers()
    }
  })
})
