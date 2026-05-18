import { setRequestLocale } from 'next-intl/server'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'

export default async function PublicProfileLayout({ params, children }: LayoutProps<'/[locale]/profile/[slug]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <TradingOnboardingProvider>
      <main className="container py-8">
        <div className="mx-auto grid max-w-6xl gap-12">
          {children}
        </div>
      </main>
    </TradingOnboardingProvider>
  )
}
