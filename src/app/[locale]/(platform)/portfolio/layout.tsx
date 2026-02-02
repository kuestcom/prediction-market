import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'

export async function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
}

export default async function PortfolioLayout({ params, children }: LayoutProps<'/[locale]/portfolio'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        {children}
      </div>
    </main>
  )
}
