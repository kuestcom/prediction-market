import { setRequestLocale } from 'next-intl/server'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function EventLayout({ params, children }: LayoutProps<'/[locale]/event/[slug]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container grid min-h-screen gap-8 pb-12 lg:grid-cols-[minmax(0,3fr)_21.25rem]">
      {children}
    </main>
  )
}
