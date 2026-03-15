'use cache'

import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import PlatformNavigationProvider from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'
import { buildChildParentMap, buildPlatformNavigationTags } from '@/lib/platform-navigation'
import { AppProviders } from '@/providers/AppProviders'

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  cacheTag(cacheTags.mainTags(resolvedLocale))
  const t = await getExtracted()
  const { data: mainTags, globalChilds = [] } = await TagRepository.getMainTags(resolvedLocale)
  const tags = buildPlatformNavigationTags({
    mainTags: mainTags ?? [],
    globalChilds,
    trendingLabel: t('Trending'),
    newLabel: t('New'),
  })
  const childParentMap = buildChildParentMap(mainTags ?? [])

  return (
    <AppProviders>
      <FilterProvider>
        <PlatformNavigationProvider tags={tags} childParentMap={childParentMap}>
          <Header />
          <NavigationTabs />
          {children}
          <AffiliateQueryHandler />
        </PlatformNavigationProvider>
      </FilterProvider>
    </AppProviders>
  )
}
