import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import HeaderMenu from '@/app/[locale]/(platform)/_components/HeaderMenu'

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="header-deposit-button" />,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/app/[locale]/(platform)/_components/HeaderDropdownUserMenuGuest', () => ({
  default: () => <div data-testid="header-guest-menu" />,
}))

vi.mock('@/app/[locale]/(platform)/_components/HeaderNotifications', () => ({
  default: () => <div data-testid="header-notifications" />,
}))

vi.mock('@/app/[locale]/(platform)/_providers/TradingOnboardingContext', () => ({
  useOptionalTradingOnboarding: () => null,
}))

vi.mock('@/components/HeaderDropdownUserMenuAuth', () => ({
  default: () => <div data-testid="header-auth-menu" />,
}))

vi.mock('@/components/HeaderPortfolio', () => ({
  default: () => <div data-testid="header-portfolio" />,
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: vi.fn() }),
}))

vi.mock('@/hooks/useHasHydrated', () => ({
  useHasHydrated: () => true,
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: mocks.useSession,
  },
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => null,
}))

describe('HeaderMenu', () => {
  it('keeps the skeleton visible until a logged-in session resolves', () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: true })

    const view = render(<HeaderMenu />)

    expect(screen.getByTestId('header-menu-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('header-login-button')).not.toBeInTheDocument()

    mocks.useSession.mockReturnValue({ data: { user: { id: 'user-1' } }, isPending: false })
    view.rerender(<HeaderMenu />)

    expect(screen.queryByTestId('header-menu-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('header-login-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-auth-menu')).toBeInTheDocument()
  })

  it('shows guest actions after an anonymous session resolves', () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false })

    render(<HeaderMenu />)

    expect(screen.queryByTestId('header-menu-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-login-button')).toBeInTheDocument()
  })
})
