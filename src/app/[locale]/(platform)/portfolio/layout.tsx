import { setRequestLocale } from 'next-intl/server'

export default async function PortfolioLayout({ params, children }: LayoutProps<'/[locale]/portfolio'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        {children}
      </div>
    </main>
  )
}
