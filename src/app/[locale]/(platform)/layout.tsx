'use cache'

import { setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { AppProviders } from '@/providers/AppProviders'

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
    ? locale
    : DEFAULT_LOCALE
  setRequestLocale(resolvedLocale)
  cacheTag(cacheTags.mainTags(resolvedLocale))

  return (
    <AppProviders>
      <TradingOnboardingProvider>
        <FilterProvider>
          <Header />
          <NavigationTabs locale={resolvedLocale} />
          {children}
          <AffiliateQueryHandler />
        </FilterProvider>
      </TradingOnboardingProvider>
    </AppProviders>
  )
}
