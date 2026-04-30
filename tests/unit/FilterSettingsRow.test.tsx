import { fireEvent, render, screen } from '@testing-library/react'
import FilterSettingsRow from '@/app/[locale]/(platform)/(home)/_components/FilterSettingsRow'
import { createDefaultFilters } from '@/app/[locale]/(platform)/(home)/_components/filter-toolbar-settings'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

describe('filterSettingsRow', () => {
  it('renders settings controls and forwards checkbox and clear actions', () => {
    const onChange = vi.fn()
    const onClear = vi.fn()

    render(
      <FilterSettingsRow
        filters={createDefaultFilters()}
        onChange={onChange}
        onClear={onClear}
        hasActiveFilters
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Sort by:' })).toHaveTextContent('24h Volume')
    expect(screen.getByRole('combobox', { name: 'Frequency:' })).toHaveTextContent('All')
    expect(screen.getByRole('combobox', { name: 'Status:' })).toHaveTextContent('Active')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide sports?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(onChange).toHaveBeenCalledWith({ hideSports: true })
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('omits filter checkboxes when they are disabled for the route', () => {
    render(
      <FilterSettingsRow
        filters={createDefaultFilters()}
        onChange={() => {}}
        onClear={() => {}}
        hasActiveFilters={false}
        showFilterCheckboxes={false}
      />,
    )

    expect(screen.queryByRole('checkbox', { name: 'Hide sports?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })
})
