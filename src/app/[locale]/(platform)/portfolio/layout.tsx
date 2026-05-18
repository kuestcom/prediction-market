import { setRequestLocale } from 'next-intl/server'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'

export default async function PortfolioLayout({ params, children }: LayoutProps<'/[locale]/portfolio'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <TradingOnboardingProvider>
      <main className="container py-8">
        <div className="mx-auto grid max-w-5xl gap-6">
          {children}
        </div>
      </main>
    </TradingOnboardingProvider>
  )
}
