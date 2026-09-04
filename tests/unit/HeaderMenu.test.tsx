import { render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  useSession: mock(),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('next/dynamic', () => ({
  default: () => () => <div data-testid="header-deposit-button" />,
}))

void mock.module('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

void mock.module('@/app/[locale]/(platform)/_components/HeaderDropdownUserMenuGuest', () => ({
  default: () => <div data-testid="header-guest-menu" />,
}))

void mock.module('@/app/[locale]/(platform)/_components/HeaderNotifications', () => ({
  default: () => <div data-testid="header-notifications" />,
}))

void mock.module('@/app/[locale]/(platform)/_providers/TradingOnboardingContext', () => ({
  useOptionalTradingOnboarding: () => null,
}))

void mock.module('@/components/HeaderDropdownUserMenuAuth', () => ({
  default: () => <div data-testid="header-auth-menu" />,
}))

void mock.module('@/components/HeaderPortfolio', () => ({
  default: () => <div data-testid="header-portfolio" />,
}))

void mock.module('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: mock() }),
}))

void mock.module('@/hooks/useHasHydrated', () => ({
  useHasHydrated: () => true,
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

void mock.module('@/lib/auth-client', () => ({
  authClient: {
    useSession: mocks.useSession,
  },
}))

void mock.module('@/stores/useUser', () => ({
  useUser: () => null,
}))

const { default: HeaderMenu } = await import('@/app/[locale]/(platform)/_components/HeaderMenu')

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
