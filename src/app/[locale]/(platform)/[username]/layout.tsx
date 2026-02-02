import { setRequestLocale } from 'next-intl/server'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ username: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function PublicProfileLayout({ params, children }: LayoutProps<'/[locale]/[username]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-8">
      <div className="mx-auto grid max-w-6xl gap-12">
        {children}
      </div>
    </main>
  )
}
