import { fireEvent, render, screen } from '@testing-library/react'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'

import FilterToolbar from '@/app/[locale]/(platform)/(home)/_components/FilterToolbar'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: () => ({ isConnected: true }),
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: mocks.open }),
}))

vi.mock('next-intl', () => ({
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
    const onFiltersChange = vi.fn()

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
    const onFiltersChange = vi.fn()

    render(<FilterToolbar collapsibleSearch filters={FILTERS} onFiltersChange={onFiltersChange} />)

    expect(screen.queryByTestId('filter-search-input')).not.toBeInTheDocument()

    const searchTrigger = screen.getByRole('button', { name: 'Open search' })
    expect(searchTrigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(searchTrigger)

    expect(screen.getByTestId('filter-search-input')).toBeVisible()
    expect(screen.queryByTestId('filter-search-trigger')).not.toBeInTheDocument()
  })

  it('closes the expanded empty search input when clicking outside', () => {
    const onFiltersChange = vi.fn()

    render(<FilterToolbar collapsibleSearch filters={FILTERS} onFiltersChange={onFiltersChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    expect(screen.getByTestId('filter-search-input')).toBeVisible()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByTestId('filter-search-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-search-trigger')).toBeVisible()
    expect(document.activeElement).toBe(screen.getByTestId('filter-search-trigger'))
  })

  it('keeps a typed query open when Escape is pressed before debounce completes', () => {
    const onFiltersChange = vi.fn()

    render(<FilterToolbar collapsibleSearch filters={FILTERS} onFiltersChange={onFiltersChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    const searchInput = screen.getByTestId('filter-search-input')

    fireEvent.change(searchInput, { target: { value: 'bitcoin' } })
    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(screen.getByTestId('filter-search-input')).toBeVisible()
  })
})
