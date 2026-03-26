'use client'

import type { ComponentProps } from 'react'
import type { SupportedLocale } from '@/i18n/locales'
import type { PredictionResultsSortOption } from '@/lib/prediction-results-filters'
import { useAppKitAccount } from '@reown/appkit/react'
import {
  BookOpenIcon,
  ChartCandlestickIcon,
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  FlameIcon,
  HouseIcon,
  InfoIcon,
  MenuIcon,
  SearchIcon,
  TrophyIcon,
  UnplugIcon,
} from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import PwaInstallIosInstructions from '@/components/PwaInstallIosInstructions'
import ThemeSelector from '@/components/ThemeSelector'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useAppKit } from '@/hooks/useAppKit'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { LOCALE_LABELS, LOOP_LABELS, normalizeEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'
import { usePathname, useRouter } from '@/i18n/navigation'
import { authClient } from '@/lib/auth-client'
import {
  buildPredictionResultsUrlSearchParams,
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
} from '@/lib/prediction-results-filters'
import { cn } from '@/lib/utils'
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

const MOBILE_BOTTOM_NAV_SPACER_CLASS = 'h-[calc(env(safe-area-inset-bottom)+4.75rem)]'

type IntentPrefetchHref = ComponentProps<typeof IntentPrefetchLink>['href']

function buildPredictionBrowseHref(baseSlug: string, sort: PredictionResultsSortOption = DEFAULT_PREDICTION_RESULTS_SORT) {
  const params = buildPredictionResultsUrlSearchParams('', {
    sort,
    status: DEFAULT_PREDICTION_RESULTS_STATUS,
  })
  const queryString = params.toString()

  return queryString
    ? `/predictions/${baseSlug}?${queryString}`
    : `/predictions/${baseSlug}`
}

function resolveMobileSearchTopicHref(slug: string) {
  if (slug === 'sports') {
    return '/sports/live'
  }

  return `/predictions/${slug}`
}

function resolveTopicAccentClassName(slug: string) {
  switch (slug) {
    case 'sports':
      return 'bg-orange-100 text-orange-700'
    case 'crypto':
      return 'bg-amber-100 text-amber-700'
    case 'politics':
      return 'bg-blue-100 text-blue-700'
    case 'finance':
      return 'bg-emerald-100 text-emerald-700'
    case 'weather':
      return 'bg-cyan-100 text-cyan-700'
    case 'tech':
    case 'ai':
      return 'bg-violet-100 text-violet-700'
    case 'pop-culture':
      return 'bg-pink-100 text-pink-700'
    default:
      return 'bg-muted text-foreground'
  }
}

function getTopicMonogram(label: string) {
  const monogram = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(segment => segment[0]?.toUpperCase() ?? '')
    .join('')

  return monogram || '?'
}

export default function MobileBottomNav() {
  const t = useExtracted()
  const pathname = usePathname()
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { data: session } = useSession()
  const user = useUser()
  const { canShowInstallUi, isIos, isPrompting, requestInstall } = usePwaInstall()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isGuestMenuOpen, setIsGuestMenuOpen] = useState(false)
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)

  const isAuthenticated = Boolean(session?.user) || Boolean(user) || isConnected

  useEffect(() => {
    setIsSearchOpen(false)
    setIsGuestMenuOpen(false)
    setIsHowItWorksOpen(false)
  }, [pathname])

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
      <div aria-hidden="true" className={cn('lg:hidden', MOBILE_BOTTOM_NAV_SPACER_CLASS)} />

      <div className="lg:hidden">
        <HowItWorks open={isHowItWorksOpen} onOpenChange={setIsHowItWorksOpen} hideTrigger />
      </div>

      <Drawer open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DrawerContent
          className="
            h-dvh max-h-dvh overflow-y-auto rounded-none border-x-0 border-b-0 border-border/70 bg-background px-4 pt-2
            pb-6
          "
        >
          <DrawerHeader className="sr-only p-0">
            <DrawerTitle>{t('Search')}</DrawerTitle>
          </DrawerHeader>
          <div className="mt-4">
            <HeaderSearch
              autoFocus
              onNavigate={() => setIsSearchOpen(false)}
              emptyState={<MobileSearchDrawerBrowse onNavigate={() => setIsSearchOpen(false)} />}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {!isAuthenticated && (
        <Drawer open={isGuestMenuOpen} onOpenChange={setIsGuestMenuOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[1.75rem] border-border/70 bg-background px-4 pt-2 pb-6">
            <div className="grid gap-4 pt-3">
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

              <div className="overflow-hidden rounded-2xl border border-border/70">
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

                {canShowInstallUi && (
                  <>
                    <div className="mx-4 h-px bg-border/70" />

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
                  </>
                )}
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
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="Primary navigation">
        <div
          className={`
            border-t border-border/70 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]
            shadow-[0_-20px_48px_-36px_rgba(15,23,42,0.55)] backdrop-blur-sm
            supports-backdrop-filter:bg-background/90
          `}
        >
          <div className="grid h-17.5 grid-cols-4">
            <MobileNavLink href="/" label={t('Home')} active={pathname === '/'} icon={HouseIcon} />
            <MobileNavLink href="/new" label={t('New')} active={pathname === '/new'} icon={FlameIcon} />
            <MobileNavButton label={t('Search')} active={isSearchOpen} onClick={() => setIsSearchOpen(true)} icon={SearchIcon} />
            {isAuthenticated
              ? (
                  <MobileNavLink
                    href="/portfolio"
                    label={t('Portfolio')}
                    active={pathname.startsWith('/portfolio')}
                    icon={ChartCandlestickIcon}
                  />
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

interface MobileSearchDrawerBrowseProps {
  onNavigate: () => void
}

function MobileSearchDrawerBrowse({ onNavigate }: MobileSearchDrawerBrowseProps) {
  const t = useExtracted()
  const { tags } = usePlatformNavigationData()
  const browseLinks = [
    { href: buildPredictionBrowseHref('trending'), label: t('Trending') },
    { href: buildPredictionBrowseHref('new'), label: t('New') },
    { href: buildPredictionBrowseHref('trending', 'volume'), label: t('Popular') },
    { href: buildPredictionBrowseHref('trending', 'ending-soon'), label: t('Ending Soon') },
    { href: buildPredictionBrowseHref('trending', 'competitive'), label: t('Competitive') },
    { href: '/sports/live', label: t('Sports') },
  ] as const

  const topicTags = tags
    .filter(tag => tag.slug !== 'trending' && tag.slug !== 'new')
    .slice(0, 8)

  return (
    <div className="mt-5 grid gap-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <section className="grid gap-3">
        <p className="text-2xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">{t('Browse')}</p>
        <div className="flex flex-wrap gap-2">
          {browseLinks.map(link => (
            <IntentPrefetchLink
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`
                rounded-full border border-border/70 bg-card px-3 py-2 text-sm font-semibold transition-colors
                hover:bg-accent hover:text-accent-foreground
              `}
            >
              {link.label}
            </IntentPrefetchLink>
          ))}
        </div>
      </section>

      {topicTags.length > 0 && (
        <section className="grid gap-3">
          <p className="text-2xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">{t('Topics')}</p>
          <div className="grid grid-cols-2 gap-2">
            {topicTags.map(tag => (
              <IntentPrefetchLink
                key={tag.slug}
                href={resolveMobileSearchTopicHref(tag.slug)}
                onClick={onNavigate}
                className={`
                  flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors
                  hover:bg-accent hover:text-accent-foreground
                `}
              >
                <div
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                    resolveTopicAccentClassName(tag.slug),
                  )}
                >
                  {getTopicMonogram(tag.name)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{tag.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tag.slug === 'sports'
                      ? t('Live markets and props')
                      : tag.childs.length > 0
                        ? t('{count} subtopics', { count: `${tag.childs.length}` })
                        : t('Browse markets')}
                  </p>
                </div>
              </IntentPrefetchLink>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

interface MobileNavLinkProps {
  active: boolean
  href: IntentPrefetchHref
  icon: typeof HouseIcon
  label: string
}

function MobileNavLink({ active, href, icon: Icon, label }: MobileNavLinkProps) {
  return (
    <IntentPrefetchLink
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        `
          flex size-full flex-col items-center justify-center gap-1.5 px-2 text-[11px] leading-none font-semibold
          transition-colors
        `,
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('size-[18px]', active && 'text-primary')} />
      <span>{label}</span>
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
          flex size-full flex-col items-center justify-center gap-1.5 px-2 text-[11px] leading-none font-semibold
          transition-colors
          focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none
        `,
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
      aria-label={label}
    >
      <Icon className={cn('size-[18px]', active && 'text-primary')} />
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
