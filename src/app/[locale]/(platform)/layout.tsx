'use cache'

import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { AppProviders } from '@/providers/AppProviders'

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <AppProviders>
      <TradingOnboardingProvider>
        <Suspense fallback={null}>
          <FilterProvider>
            <Header />
            <NavigationTabs />
            {children}
            <AffiliateQueryHandler />
          </FilterProvider>
        </Suspense>
      </TradingOnboardingProvider>
    </AppProviders>
  )
}
