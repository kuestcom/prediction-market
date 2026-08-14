import { fireEvent, render, screen } from '@testing-library/react'

import CommunityFollowButton from '@/components/CommunityFollowButton'

const mocks = vi.hoisted(() => ({
  toggleFollow: vi.fn(),
  useCommunityFollow: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/providers/CommunityFollowsProvider', () => ({
  useCommunityFollow: (...args: unknown[]) => mocks.useCommunityFollow(...args),
}))

describe('CommunityFollowButton', () => {
  beforeEach(() => {
    mocks.toggleFollow.mockReset()
    mocks.useCommunityFollow.mockReset()
    mocks.useCommunityFollow.mockReturnValue({
      canFollow: true,
      isFollowing: false,
      isPending: false,
      toggleFollow: mocks.toggleFollow,
    })
  })

  it('exposes an accessible pressed state and stops parent navigation', () => {
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <CommunityFollowButton wallet="0x1111111111111111111111111111111111111111" variant="icon" />
      </div>,
    )

    const button = screen.getByRole('button', { name: 'Follow trader' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(mocks.toggleFollow).toHaveBeenCalledTimes(1)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('renders Following and disables duplicate clicks while pending', () => {
    mocks.useCommunityFollow.mockReturnValue({
      canFollow: true,
      isFollowing: true,
      isPending: true,
      toggleFollow: mocks.toggleFollow,
    })
    render(<CommunityFollowButton wallet="0x1111111111111111111111111111111111111111" />)

    const button = screen.getByRole('button', { name: 'Unfollow trader' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Following')
  })

  it('renders an explicit Unfollow action in management lists', () => {
    mocks.useCommunityFollow.mockReturnValue({
      canFollow: true,
      isFollowing: true,
      isPending: false,
      toggleFollow: mocks.toggleFollow,
    })

    render(<CommunityFollowButton wallet="0x1111111111111111111111111111111111111111" variant="manage" />)

    fireEvent.click(screen.getByRole('button', { name: 'Unfollow trader' }))
    expect(screen.getByRole('button', { name: 'Unfollow trader' })).toHaveTextContent('Unfollow')
    expect(mocks.toggleFollow).toHaveBeenCalledOnce()
  })

  it('hides on the viewer own profile', () => {
    mocks.useCommunityFollow.mockReturnValue({
      canFollow: false,
      isFollowing: false,
      isPending: false,
      toggleFollow: mocks.toggleFollow,
    })
    const { container } = render(<CommunityFollowButton wallet="0x1111111111111111111111111111111111111111" />)
    expect(container).toBeEmptyDOMElement()
  })
})
