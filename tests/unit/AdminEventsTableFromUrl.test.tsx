import type { MockInstance } from 'vitest'

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AdminEventsTableFromUrl from '@/app/[locale]/admin/events/_components/AdminEventsTableFromUrl'

const mocks = vi.hoisted(() => ({
  pathname: '/admin/events',
  searchParams: new URLSearchParams(),
}))

let replaceStateSpy: MockInstance<History['replaceState']>

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
}))

vi.mock('@/app/[locale]/admin/events/_components/AdminEventsTable', () => {
  return {
    default: function MockAdminEventsTable({
      tableState,
      onTableStateChange,
    }: {
      tableState: {
        attention: string
        mainCategorySlug: string
      }
      onTableStateChange: (patch: Record<string, unknown>) => void
    }) {
      return (
        <>
          <div>{tableState.attention}</div>
          <div>{tableState.mainCategorySlug}</div>
          <button
            type="button"
            onClick={() =>
              onTableStateChange({
                mainCategorySlug: 'all',
                creator: 'all',
                seriesSlug: 'all',
                activeOnly: false,
                attention: 'all',
                pageIndex: 0,
              })
            }
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={() =>
              onTableStateChange({
                mainCategorySlug: 'politics',
                attention: 'past-due-unresolved',
                pageIndex: 0,
              })
            }
          >
            Apply filters
          </button>
        </>
      )
    },
  }
})

function renderTable() {
  return render(
    <AdminEventsTableFromUrl
      configuredSportsSourceProviders={[]}
      initialAutoDeployNewEventsEnabled={false}
      mainCategoryOptions={[]}
    />,
  )
}

function setSearchParams(value: string) {
  mocks.searchParams = new URLSearchParams(value)
  window.history.replaceState(null, '', value ? `/admin/events?${value}` : '/admin/events')
}

describe('adminEventsTableFromUrl', () => {
  beforeEach(() => {
    mocks.pathname = '/admin/events'
    mocks.searchParams = new URLSearchParams()
    window.history.replaceState(null, '', '/admin/events')
    replaceStateSpy = vi.spyOn(window.history, 'replaceState')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies filters from the current URL', () => {
    setSearchParams('attention=past-due-unresolved&category=politics')

    renderTable()

    expect(screen.getByText('past-due-unresolved')).toBeVisible()
    expect(screen.getByText('politics')).toBeVisible()
  })

  it('responds when URL filters change', () => {
    const view = renderTable()

    setSearchParams('attention=missing-sports-id&category=sports')
    view.rerender(
      <AdminEventsTableFromUrl
        configuredSportsSourceProviders={[]}
        initialAutoDeployNewEventsEnabled={false}
        mainCategoryOptions={[]}
      />,
    )

    expect(screen.getByText('missing-sports-id')).toBeVisible()
    expect(screen.getByText('sports')).toBeVisible()
  })

  it('removes dialog filters from the URL when filters are cleared', () => {
    setSearchParams(
      'attention=past-due-unresolved&category=politics&creator=0x1&series=daily&active=1&page=2&search=election',
    )

    renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/admin/events?search=election')
  })

  it('writes applied filters to the URL and resets pagination', () => {
    setSearchParams('page=2')

    renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      '',
      '/admin/events?category=politics&attention=past-due-unresolved',
    )
  })
})
