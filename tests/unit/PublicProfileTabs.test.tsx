import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as actualReact from 'react'

import { hoisted } from '../bun-test-helpers'

const originalStartTransition = actualReact.startTransition

const mocks = hoisted(() => ({
  inTransition: false,
  pathname: '/@ibruno',
  replace: mock(),
  replaceWasInTransition: false,
  searchParams: new URLSearchParams(),
}))

void mock.module('react', () => {
  return {
    ...actualReact,
    startTransition: (action: () => void) => {
      originalStartTransition(() => {
        mocks.inTransition = true
        try {
          action()
        } finally {
          mocks.inTransition = false
        }
      })
    },
  }
})

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

void mock.module('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}))

void mock.module('@/app/[locale]/(platform)/profile/_components/PublicPositionsList', () => ({
  default: () => <div>Positions content</div>,
}))

void mock.module('@/app/[locale]/(platform)/profile/_components/PublicActivityList', () => ({
  default: () => <div>Activity content</div>,
}))

const { default: PublicProfileTabs } = await import('@/app/[locale]/(platform)/profile/_components/PublicProfileTabs')

const resolutionsContent = <div>Resolutions content</div>

describe('publicProfileTabs', () => {
  beforeEach(() => {
    mocks.inTransition = false
    mocks.pathname = '/@ibruno'
    mocks.replace.mockReset()
    mocks.replace.mockImplementation(() => {
      mocks.replaceWasInTransition = mocks.inTransition
    })
    mocks.replaceWasInTransition = false
    mocks.searchParams = new URLSearchParams()
  })

  it('selects activity from the query string', () => {
    mocks.searchParams = new URLSearchParams('tab=activity')

    render(<PublicProfileTabs userAddress="0x123" resolutionsContent={resolutionsContent} />)

    expect(screen.getByText('Activity content')).toBeVisible()
    expect(screen.queryByText('Positions content')).not.toBeInTheDocument()
  })

  it('updates the query string while preserving other parameters', () => {
    mocks.searchParams = new URLSearchParams('ref=profile')

    render(<PublicProfileTabs userAddress="0x123" resolutionsContent={resolutionsContent} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }))

    expect(mocks.replace).toHaveBeenCalledWith('/@ibruno?ref=profile&tab=activity', { scroll: false })
    expect(mocks.replaceWasInTransition).toBe(true)
  })

  it('selects resolutions from the query string', () => {
    mocks.searchParams = new URLSearchParams('tab=resolutions')

    render(<PublicProfileTabs userAddress="0x123" resolutionsContent={resolutionsContent} />)

    expect(screen.getByText('Resolutions content')).toBeVisible()
    expect(screen.queryByText('Positions content')).not.toBeInTheDocument()
  })

  it('links the resolutions tab while preserving other parameters', () => {
    mocks.searchParams = new URLSearchParams('ref=profile')

    render(<PublicProfileTabs userAddress="0x123" resolutionsContent={resolutionsContent} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Resolutions' }))

    expect(mocks.replace).toHaveBeenCalledWith('/@ibruno?ref=profile&tab=resolutions', { scroll: false })
  })
})
