import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import HeaderSearch from '@/app/[locale]/(platform)/_components/HeaderSearch'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  clearSearch: mock(),
  handleQueryChange: mock(),
  hideResults: mock(),
  push: mock(),
  setActiveTab: mock(),
  showSearchResults: mock(),
  useSearch: mock(),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('lucide-react', () => ({
  SearchIcon: () => <svg data-testid="search-icon" />,
  XIcon: () => <svg data-testid="clear-search-icon" />,
}))

void mock.module('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

void mock.module('@/hooks/useSearch', () => ({
  useSearch: () => mocks.useSearch(),
}))

void mock.module('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => ({ name: 'Events and profiles' }),
}))

void mock.module('@/app/[locale]/(platform)/_components/SearchResults', () => ({
  SearchResults: () => <div data-testid="search-results" />,
}))

describe('headerSearch', () => {
  beforeEach(() => {
    mocks.clearSearch.mockReset()
    mocks.handleQueryChange.mockReset()
    mocks.hideResults.mockReset()
    mocks.push.mockReset()
    mocks.setActiveTab.mockReset()
    mocks.showSearchResults.mockReset()
    mocks.useSearch.mockReset()
    mocks.useSearch.mockReturnValue({
      activeTab: 'events',
      clearSearch: mocks.clearSearch,
      handleQueryChange: mocks.handleQueryChange,
      hideResults: mocks.hideResults,
      isLoading: {
        events: false,
        profiles: false,
      },
      query: 'brazil',
      results: {
        events: [],
        profiles: [],
      },
      setActiveTab: mocks.setActiveTab,
      showResults: false,
      showSearchResults: mocks.showSearchResults,
    })
  })

  it('navigates to the prediction results page when enter is pressed', () => {
    render(<HeaderSearch />)

    fireEvent.keyDown(screen.getByTestId('header-search-input'), { key: 'Enter' })

    expect(mocks.clearSearch).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/predictions/brazil')
  })

  it('does not navigate when the query cannot generate a prediction results slug', () => {
    mocks.useSearch.mockReturnValue({
      activeTab: 'events',
      clearSearch: mocks.clearSearch,
      handleQueryChange: mocks.handleQueryChange,
      hideResults: mocks.hideResults,
      isLoading: {
        events: false,
        profiles: false,
      },
      query: '!!!',
      results: {
        events: [],
        profiles: [],
      },
      setActiveTab: mocks.setActiveTab,
      showResults: false,
      showSearchResults: mocks.showSearchResults,
    })

    render(<HeaderSearch />)

    fireEvent.keyDown(screen.getByTestId('header-search-input'), { key: 'Enter' })

    expect(mocks.clearSearch).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('identifies the slash focus shortcut as keyboard input', () => {
    mocks.useSearch.mockReturnValue({
      activeTab: 'events',
      clearSearch: mocks.clearSearch,
      handleQueryChange: mocks.handleQueryChange,
      hideResults: mocks.hideResults,
      isLoading: {
        events: false,
        profiles: false,
      },
      query: '',
      results: {
        events: [],
        profiles: [],
      },
      setActiveTab: mocks.setActiveTab,
      showResults: false,
      showSearchResults: mocks.showSearchResults,
    })

    render(<HeaderSearch />)

    expect(screen.getByText('/').tagName).toBe('KBD')
  })

  it('closes the attached dropdown when escape is pressed', () => {
    mocks.useSearch.mockReturnValue({
      activeTab: 'events',
      clearSearch: mocks.clearSearch,
      handleQueryChange: mocks.handleQueryChange,
      hideResults: mocks.hideResults,
      isLoading: {
        events: false,
        profiles: false,
      },
      query: 'brazil',
      results: {
        events: [],
        profiles: [],
      },
      setActiveTab: mocks.setActiveTab,
      showResults: true,
      showSearchResults: mocks.showSearchResults,
    })

    render(<HeaderSearch />)

    expect(screen.getByTestId('search-results')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByTestId('header-search-input'), { key: 'Escape' })

    expect(mocks.hideResults).toHaveBeenCalledTimes(1)
    expect(mocks.clearSearch).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
  })

  it('keeps the attached dropdown open when escape is pressed during composition', () => {
    mocks.useSearch.mockReturnValue({
      activeTab: 'events',
      clearSearch: mocks.clearSearch,
      handleQueryChange: mocks.handleQueryChange,
      hideResults: mocks.hideResults,
      isLoading: {
        events: false,
        profiles: false,
      },
      query: 'brazil',
      results: {
        events: [],
        profiles: [],
      },
      setActiveTab: mocks.setActiveTab,
      showResults: true,
      showSearchResults: mocks.showSearchResults,
    })

    render(<HeaderSearch />)

    expect(screen.getByTestId('search-results')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByTestId('header-search-input'), {
      key: 'Escape',
      isComposing: true,
    })

    expect(mocks.hideResults).not.toHaveBeenCalled()
    expect(screen.getByTestId('search-results')).toBeInTheDocument()
  })
})
