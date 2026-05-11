import { render, screen } from '@testing-library/react'
import MobileBottomNav from '@/app/[locale]/(platform)/_components/MobileBottomNav'

const mocks = vi.hoisted(() => ({
  useHasHydrated: vi.fn(),
  useSession: vi.fn(),
  useUser: vi.fn(),
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => function MockDynamicComponent() {
    return <div data-testid="mobile-bottom-nav-dynamic" />
  },
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
  useLocale: () => 'en',
}))

vi.mock('@/app/[locale]/(platform)/_components/SearchDiscoveryContent', () => ({
  default: () => <div data-testid="search-discovery" />,
}))

vi.mock('@/components/AppLink', () => ({
  default: function MockAppLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  },
}))

vi.mock('@/components/PwaInstallIosInstructions', () => ({
  default: () => <div data-testid="pwa-ios-instructions" />,
}))

vi.mock('@/components/ThemeSelector', () => ({
  default: () => <div data-testid="theme-selector" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: any) => <div>{children}</div>,
  DrawerClose: ({ children }: any) => <>{children}</>,
  DrawerContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DrawerHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: any) => <span {...props} />,
}))

vi.mock('@/hooks/useAppKit', () => ({
  useAppKit: () => ({ open: vi.fn() }),
}))

vi.mock('@/hooks/useBalance', () => ({
  useBalance: () => ({ balance: { raw: 0 }, isLoadingBalance: false }),
}))

vi.mock('@/hooks/useHasHydrated', () => ({
  useHasHydrated: () => mocks.useHasHydrated(),
}))

vi.mock('@/hooks/usePortfolioValue', () => ({
  usePortfolioValue: () => ({ isLoading: false, value: 0 }),
}))

vi.mock('@/hooks/usePwaInstall', () => ({
  usePwaInstall: () => ({
    canShowInstallUi: false,
    isIos: false,
    isPrompting: false,
    requestInstall: vi.fn(),
  }),
}))

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/crypto',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => mocks.useSession(),
  },
}))

vi.mock('@/stores/usePortfolioValueVisibility', () => ({
  usePortfolioValueVisibility: (selector: (state: { isHidden: boolean }) => unknown) => selector({ isHidden: false }),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => mocks.useUser(),
}))

describe('mobileBottomNav', () => {
  beforeEach(() => {
    mocks.useHasHydrated.mockReset()
    mocks.useSession.mockReset()
    mocks.useUser.mockReset()
    mocks.useHasHydrated.mockReturnValue(false)
    mocks.useSession.mockReturnValue({ data: { user: { id: 'user-1' } } })
    mocks.useUser.mockReturnValue({ id: 'user-1' })
  })

  it('keeps the hydration render on the guest fourth-tab shape', () => {
    render(<MobileBottomNav />)

    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Portfolio' })).not.toBeInTheDocument()
  })

  it('shows the portfolio tab after hydration for authenticated users', () => {
    mocks.useHasHydrated.mockReturnValue(true)

    render(<MobileBottomNav />)

    expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
  })
})
