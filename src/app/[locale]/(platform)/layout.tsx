import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Skeleton } from '@/components/ui/skeleton'
import { AppProviders } from '@/providers/AppProviders'

function NavSkeleton() {
  return (
    <nav className="sticky top-14 z-10 border-b bg-background">
      <div className="container scrollbar-hide flex gap-6 overflow-x-auto text-sm font-medium">
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
      </div>
    </nav>
  )
}

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <AppProviders>
      <TradingOnboardingProvider>
        <FilterProvider>
          <Header />
          <Suspense fallback={<NavSkeleton />}>
            <NavigationTabs />
          </Suspense>
          {children}
          <AffiliateQueryHandler />
        </FilterProvider>
      </TradingOnboardingProvider>
    </AppProviders>
  )
}
