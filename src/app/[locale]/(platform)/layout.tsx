import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import MobileBottomNav from '@/app/[locale]/(platform)/_components/MobileBottomNav'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import PlatformViewerState from '@/app/[locale]/(platform)/_components/PlatformViewerState'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import PlatformNavigationProvider from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { loadPlatformMainTags } from '@/lib/platform-main-tags'
import { buildChildParentMap, buildPlatformNavigationTags } from '@/lib/platform-navigation'
import AppKitProvider from '@/providers/AppKitProvider'

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  const t = await getExtracted()
  const { data: mainTags, globalChilds = [] } = await loadPlatformMainTags(resolvedLocale)
  const tags = buildPlatformNavigationTags({
    mainTags: mainTags ?? [],
    globalChilds,
    trendingLabel: t('Trending'),
    newLabel: t('New'),
  })
  const childParentMap = buildChildParentMap(mainTags ?? [])

  return (
    <AppKitProvider>
      <PlatformViewerState />
      <FilterProvider>
        <PlatformNavigationProvider tags={tags} childParentMap={childParentMap}>
          <Header />
          <NavigationTabs />
          {children}
          <MobileBottomNav />
          <AffiliateQueryHandler />
        </PlatformNavigationProvider>
      </FilterProvider>
    </AppKitProvider>
  )
}
