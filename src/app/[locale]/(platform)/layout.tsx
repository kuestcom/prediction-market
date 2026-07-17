import type { ReactNode } from 'react'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { PlatformLayoutFooter } from '@/app/[locale]/(platform)/(home)/_components/PlatformFooter'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import MobileBottomNav from '@/app/[locale]/(platform)/_components/MobileBottomNav'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import PlatformViewerState from '@/app/[locale]/(platform)/_components/PlatformViewerState'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import PlatformNavigationProvider from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { loadPlatformMainTags } from '@/lib/platform-main-tags'
import { buildChildParentMap, buildPlatformNavigationTags } from '@/lib/platform-navigation'
import { shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'
import { getWagmiStateCookieValue } from '@/lib/wagmi-storage.server'
import AppKitProvider from '@/providers/AppKitProvider'

async function loadPlatformLayoutNavigation(locale: SupportedLocale) {
  'use cache'

  const t = await getExtracted({ locale })
  const { data: mainTags, globalChilds = [] } = await loadPlatformMainTags(locale)

  return {
    tags: buildPlatformNavigationTags({
      mainTags: mainTags ?? [],
      globalChilds,
      trendingLabel: t('Trending'),
      newLabel: t('New'),
    }),
    childParentMap: buildChildParentMap(mainTags ?? []),
  }
}

async function PlatformLayoutContent({
  children,
  locale,
}: {
  children: ReactNode
  locale: SupportedLocale
}) {
  const { tags, childParentMap } = await loadPlatformLayoutNavigation(locale)

  return (
    <TradingOnboardingProvider>
      <PlatformViewerState />
      <FilterProvider>
        <PlatformNavigationProvider tags={tags} childParentMap={childParentMap}>
          <Header />
          <NavigationTabs />
          {children}
          <PlatformLayoutFooter />
          <MobileBottomNav />
          <AffiliateQueryHandler />
        </PlatformNavigationProvider>
      </FilterProvider>
    </TradingOnboardingProvider>
  )
}

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  const wagmiCookie = shouldPrerenderPublicShell()
    ? null
    : await getWagmiStateCookieValue()
  setRequestLocale(resolvedLocale)

  return (
    <AppKitProvider wagmiCookie={wagmiCookie}>
      <PlatformLayoutContent locale={resolvedLocale}>
        {children}
      </PlatformLayoutContent>
    </AppKitProvider>
  )
}
