'use client'

import type { Route } from 'next'
import type { ComponentProps, ReactNode } from 'react'
import type { SupportedLocale } from '@/i18n/locales'
import { useAppKitAccount } from '@reown/appkit/react'
import {
  BookOpenIcon,
  ChartLineIcon,
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  HouseIcon,
  InfoIcon,
  MenuIcon,
  SearchIcon,
  SparkleIcon,
  TrophyIcon,
  UnplugIcon,
} from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import SearchDiscoveryContent from '@/app/[locale]/(platform)/_components/SearchDiscoveryContent'
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/app/[locale]/(platform)/_lib/mobile-bottom-nav'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import PwaInstallIosInstructions from '@/components/PwaInstallIosInstructions'
import ThemeSelector from '@/components/ThemeSelector'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppKit } from '@/hooks/useAppKit'
import { useBalance } from '@/hooks/useBalance'
import { usePortfolioValue } from '@/hooks/usePortfolioValue'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { LOCALE_LABELS, LOOP_LABELS, normalizeEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'
import { usePathname, useRouter } from '@/i18n/navigation'
import { authClient } from '@/lib/auth-client'
import { formatCompactCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'
import { useUser } from '@/stores/useUser'

const HeaderSearch = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HeaderSearch'),
  { ssr: false },
)

const HowItWorks = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HowItWorks'),
  { ssr: false },
)

const { useSession } = authClient

export default function MobileBottomNav() {
  const t = useExtracted()
  const pathname = usePathname()
  const router = useRouter()
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { data: session } = useSession()
  const user = useUser()
  const { canShowInstallUi, isIos, isPrompting, requestInstall } = usePwaInstall()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0)
  const [isGuestMenuOpen, setIsGuestMenuOpen] = useState(false)
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)

  const isAuthenticated = Boolean(session?.user) || Boolean(user) || isConnected

  useEffect(() => {
    setIsSearchOpen(false)
    setIsGuestMenuOpen(false)
    setIsHowItWorksOpen(false)
  }, [pathname])

  function focusMobileSearchInput() {
    const input = document.querySelector<HTMLInputElement>(
      '[data-mobile-search-drawer="true"] input[data-testid="header-search-input"]',
    )

    if (!input) {
      return false
    }

    input.focus({ preventScroll: true })
    return document.activeElement === input
  }

  function handleSearchAction() {
    // iOS only opens the keyboard if the input focus stays inside the tap gesture.
    // eslint-disable-next-line react-dom/no-flush-sync
    flushSync(() => {
      setIsSearchOpen(true)
    })

    if (focusMobileSearchInput()) {
      setSearchFocusTrigger(0)
      return
    }

    setSearchFocusTrigger(prev => prev + 1)
  }

  function resetSearchDrawerInteractionState() {
    setSearchFocusTrigger(0)

    window.setTimeout(() => {
      const activeElement = document.activeElement

      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }
    }, 0)
  }

  function handleSearchOpenChange(nextOpen: boolean) {
    setIsSearchOpen(nextOpen)

    if (nextOpen) {
      return
    }

    resetSearchDrawerInteractionState()
  }

  function handleSearchNavigate() {
    setIsSearchOpen(false)
    resetSearchDrawerInteractionState()
  }

  function handlePredictionResultsNavigate(href: Route) {
    setIsSearchOpen(false)
    resetSearchDrawerInteractionState()
    router.push(href)
  }

  async function handleInstallAction() {
    setIsGuestMenuOpen(false)

    if (isIos) {
      toast.info(t('Install app'), {
        description: (
          <PwaInstallIosInstructions className="max-w-sm pt-1" />
        ),
      })
      return
    }

    try {
      await requestInstall()
    }
    catch {
      toast.error(t('An unexpected error occurred. Please try again.'))
    }
  }

  function handleAuthAction() {
    setIsGuestMenuOpen(false)
    window.setTimeout(() => {
      void open()
    }, 120)
  }

  function handleHowItWorksAction() {
    setIsGuestMenuOpen(false)
    window.setTimeout(() => {
      setIsHowItWorksOpen(true)
    }, 120)
  }

  return (
    <>
      <div aria-hidden="true" className="lg:hidden" style={{ height: MOBILE_BOTTOM_NAV_OFFSET }} />

      <div className="lg:hidden">
        <HowItWorks
          open={isHowItWorksOpen}
          onOpenChange={setIsHowItWorksOpen}
          hideTrigger
          displayMode="mobile"
        />
      </div>

      <Drawer
        open={isSearchOpen}
        onOpenChange={handleSearchOpenChange}
        fixed
        repositionInputs={false}
      >
        <DrawerContent
          data-mobile-search-drawer="true"
          className="
            h-[90dvh] max-h-dvh overflow-y-auto rounded-none border-x-0 border-b-0 border-border/70 bg-background px-2
            pt-2 pb-6
          "
        >
          <DrawerHeader className="sr-only p-0">
            <DrawerTitle>{t('Search')}</DrawerTitle>
          </DrawerHeader>
          <div className="mt-4">
            <HeaderSearch
              onNavigate={handleSearchNavigate}
              onPredictionResultsNavigate={handlePredictionResultsNavigate}
              emptyState={<SearchDiscoveryContent onNavigate={handleSearchNavigate} />}
              focusTrigger={searchFocusTrigger}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {!isAuthenticated && (
        <Drawer open={isGuestMenuOpen} onOpenChange={setIsGuestMenuOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[1.75rem] border-border/70 bg-background px-4 pt-2 pb-6">
            <div className="grid gap-4 pt-3">
              <div className="overflow-hidden rounded-2xl border border-border/70">
                {canShowInstallUi && (
                  <>
                    <button
                      type="button"
                      className={`
                        flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold
                        disabled:pointer-events-none disabled:opacity-50
                      `}
                      onClick={() => {
                        void handleInstallAction()
                      }}
                      disabled={isPrompting}
                    >
                      <DownloadIcon className="size-4 text-sky-500" />
                      {t('Install app')}
                    </button>

                    <div className="mx-4 h-px bg-border/70" />
                  </>
                )}

                <DrawerClose asChild>
                  <IntentPrefetchLink
                    href="/leaderboard"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold"
                  >
                    <TrophyIcon className="size-4 text-amber-500" />
                    {t('Leaderboard')}
                  </IntentPrefetchLink>
                </DrawerClose>

                <div className="mx-4 h-px bg-border/70" />

                <DrawerClose asChild>
                  <IntentPrefetchLink
                    href="/docs/api-reference"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold"
                  >
                    <UnplugIcon className="size-4 text-pink-500" />
                    {t('APIs')}
                  </IntentPrefetchLink>
                </DrawerClose>
              </div>

              <div className="rounded-2xl border border-border/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{t('Dark Mode')}</span>
                  <ThemeSelector />
                </div>
              </div>

              <MobileLocaleSwitcher onLocaleChange={() => setIsGuestMenuOpen(false)} />

              <div className="overflow-hidden rounded-2xl border border-border/70">
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold"
                    onClick={handleHowItWorksAction}
                  >
                    <InfoIcon className="size-4 text-primary" />
                    {t('How it works')}
                  </button>
                </DrawerClose>

                <div className="mx-4 h-px bg-border/70" />

                <DrawerClose asChild>
                  <IntentPrefetchLink
                    href="/docs/users"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold"
                  >
                    <BookOpenIcon className="size-4 text-muted-foreground" />
                    {t('Documentation')}
                  </IntentPrefetchLink>
                </DrawerClose>

                <div className="mx-4 h-px bg-border/70" />

                <DrawerClose asChild>
                  <IntentPrefetchLink
                    href="/terms-of-use"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold"
                  >
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    {t('Terms of Use')}
                  </IntentPrefetchLink>
                </DrawerClose>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <DrawerClose asChild>
                  <Button type="button" variant="outline" className="h-10" onClick={handleAuthAction}>
                    {t('Log In')}
                  </Button>
                </DrawerClose>
                <DrawerClose asChild>
                  <Button type="button" className="h-10" onClick={handleAuthAction}>
                    {t('Sign Up')}
                  </Button>
                </DrawerClose>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="Primary navigation">
        <div
          className={`
            border-t border-border/70 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]
            shadow-[0_-20px_48px_-36px_rgba(15,23,42,0.55)] backdrop-blur-sm
            supports-backdrop-filter:bg-background/90
          `}
        >
          <div className="grid h-16.5 grid-cols-4">
            <MobileNavLink href="/" label={t('Home')} active={pathname === '/'} icon={HouseIcon} />
            <MobileNavButton label={t('Search')} active={isSearchOpen} onClick={handleSearchAction} icon={SearchIcon} />
            <MobileNavLink href="/new" label={t('New')} active={pathname === '/new'} icon={SparkleIcon} />
            {isAuthenticated
              ? (
                  <MobilePortfolioNavLink active={pathname.startsWith('/portfolio')} />
                )
              : (
                  <MobileNavButton
                    label={t('More')}
                    active={isGuestMenuOpen}
                    onClick={() => setIsGuestMenuOpen(true)}
                    icon={MenuIcon}
                  />
                )}
          </div>
        </div>
      </nav>
    </>
  )
}

interface MobileNavLinkProps {
  active: boolean
  href: ComponentProps<typeof IntentPrefetchLink>['href']
  icon: typeof HouseIcon
  label: ReactNode
}

function MobileNavLink({ active, href, icon: Icon, label }: MobileNavLinkProps) {
  return (
    <IntentPrefetchLink
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        `
          flex size-full flex-col items-center justify-center gap-1 px-2 text-[11px] leading-none font-semibold
          transition-colors
        `,
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-[17px]" />
      <span className="max-w-full truncate">{label}</span>
    </IntentPrefetchLink>
  )
}

function MobilePortfolioNavLink({ active }: { active: boolean }) {
  const t = useExtracted()
  const { balance, isLoadingBalance } = useBalance()
  const { isLoading, value: positionsValue } = usePortfolioValue()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)
  const isLoadingValue = isLoadingBalance || isLoading
  const totalPortfolioValue = (positionsValue ?? 0) + (balance?.raw ?? 0)
  const portfolioValueLabel = Number.isFinite(totalPortfolioValue)
    ? formatCompactCurrency(totalPortfolioValue)
    : '$0.00'

  return (
    <IntentPrefetchLink
      href="/portfolio"
      aria-current={active ? 'page' : undefined}
      aria-label={t('Portfolio')}
      className={cn(
        `
          flex size-full flex-col items-center justify-center gap-1 px-2 text-[11px] leading-none font-semibold
          transition-colors
        `,
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <ChartLineIcon className="size-[17px]" />
      {isLoadingValue
        ? <Skeleton className="h-3 w-12 rounded-full" />
        : (
            <span className="max-w-full truncate">
              {areValuesHidden ? '****' : portfolioValueLabel}
            </span>
          )}
    </IntentPrefetchLink>
  )
}

interface MobileNavButtonProps {
  active: boolean
  icon: typeof HouseIcon
  label: string
  onClick: () => void
}

function MobileNavButton({ active, icon: Icon, label, onClick }: MobileNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `
          flex size-full flex-col items-center justify-center gap-1 px-2 text-[11px] leading-none font-semibold
          transition-colors
          focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none
        `,
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
      aria-label={label}
    >
      <Icon className="size-[17px]" />
      <span>{label}</span>
    </button>
  )
}

interface MobileLocaleSwitcherProps {
  onLocaleChange?: () => void
}

function MobileLocaleSwitcher({ onLocaleChange }: MobileLocaleSwitcherProps) {
  const locale = useLocale() as SupportedLocale
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const [isPending, startTransition] = useTransition()
  const [enabledLocales, setEnabledLocales] = useState<SupportedLocale[]>([...SUPPORTED_LOCALES])

  useEffect(() => {
    let isActive = true

    async function loadEnabledLocales() {
      try {
        const response = await fetch('/api/locales')
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        if (!isActive || !Array.isArray(payload?.locales)) {
          return
        }

        const normalized = normalizeEnabledLocales(payload.locales)
        if (normalized.length > 0) {
          setEnabledLocales(normalized)
        }
      }
      catch (error) {
        console.error('Failed to load enabled locales', error)
      }
    }

    void loadEnabledLocales()

    return () => {
      isActive = false
    }
  }, [])

  function handleLocaleChange(nextLocale: SupportedLocale) {
    if (nextLocale === locale) {
      return
    }

    onLocaleChange?.()
    startTransition(() => {
      // @ts-expect-error -- next-intl validates that params match the pathname.
      router.replace({ pathname, params }, { locale: nextLocale })
    })
  }

  return (
    <div className="rounded-2xl border border-border/70 px-4 py-3">
      <div className="mb-3 text-sm font-semibold">
        {LOOP_LABELS[locale] ?? 'Language'}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {enabledLocales.map(option => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={option === locale ? 'default' : 'outline'}
            className="justify-between"
            onClick={() => handleLocaleChange(option)}
            disabled={isPending}
          >
            <span>{LOCALE_LABELS[option] ?? option.toUpperCase()}</span>
            {option === locale && <CheckIcon className="size-4" />}
          </Button>
        ))}
      </div>
    </div>
  )
}
