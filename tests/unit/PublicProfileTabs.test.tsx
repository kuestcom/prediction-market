import { fireEvent, render, screen } from '@testing-library/react'
import PublicProfileTabs from '@/app/[locale]/(platform)/profile/_components/PublicProfileTabs'

const mocks = vi.hoisted(() => ({
  inTransition: false,
  pathname: '/@ibruno',
  replace: vi.fn(),
  replaceWasInTransition: false,
  searchParams: new URLSearchParams(),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()

  return {
    ...actual,
    startTransition: (action: () => void) => {
      actual.startTransition(() => {
        mocks.inTransition = true
        try {
          action()
        }
        finally {
          mocks.inTransition = false
        }
      })
    },
  }
})

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}))

vi.mock('@/hooks/useTabIndicatorPosition', () => ({
  useTabIndicatorPosition: () => ({
    tabRef: { current: [] },
    indicatorStyle: { left: 0, width: 0 },
    isInitialized: true,
  }),
}))

vi.mock('@/app/[locale]/(platform)/profile/_components/PublicPositionsList', () => ({
  default: () => <div>Positions content</div>,
}))

vi.mock('@/app/[locale]/(platform)/profile/_components/PublicActivityList', () => ({
  default: () => <div>Activity content</div>,
}))

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

    render(<PublicProfileTabs userAddress="0x123" />)

    expect(screen.getByText('Activity content')).toBeVisible()
    expect(screen.queryByText('Positions content')).not.toBeInTheDocument()
  })

  it('updates the query string while preserving other parameters', () => {
    mocks.searchParams = new URLSearchParams('ref=profile')

    render(<PublicProfileTabs userAddress="0x123" />)
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }))

    expect(mocks.replace).toHaveBeenCalledWith(
      '/@ibruno?ref=profile&tab=activity',
      { scroll: false },
    )
    expect(mocks.replaceWasInTransition).toBe(true)
  })
})
