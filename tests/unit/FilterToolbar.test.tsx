import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'
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

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
    const LazyComponent = React.lazy(loader)

    return function MockDynamicComponent(props: Record<string, unknown>) {
      return (
        <React.Suspense fallback={null}>
          <LazyComponent {...props} />
        </React.Suspense>
      )
    }
  },
}))

const FILTERS = {
  tag: 'trending',
  mainTag: 'trending',
  search: '',
  bookmarked: false,
  frequency: 'all',
  status: 'active',
  hideSports: false,
  hideCrypto: false,
  hideEarnings: false,
} as const satisfies FilterState

describe('filterToolbar', () => {
  it('loads settings controls only after the settings toggle opens', async () => {
    const onFiltersChange = vi.fn()

    render(
      <FilterToolbar
        filters={FILTERS}
        onFiltersChange={onFiltersChange}
      />,
    )

    expect(screen.queryByRole('combobox', { name: 'Sort by:' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open filters' }))

    const sortControls = await screen.findAllByRole('combobox', { name: 'Sort by:' })
    expect(sortControls[0]).toHaveTextContent('24h Volume')

    const hideSportsCheckboxes = await screen.findAllByRole('checkbox', { name: 'Hide sports?' })
    fireEvent.click(hideSportsCheckboxes[0])

    expect(onFiltersChange).toHaveBeenCalledWith({ hideSports: true })
  })
})
