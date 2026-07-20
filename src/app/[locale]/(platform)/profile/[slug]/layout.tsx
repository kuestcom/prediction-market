import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import Loading from './loading'

async function PublicProfileLayoutContent({ params, children }: LayoutProps<'/[locale]/profile/[slug]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  await connection()

  return children
}

export default function PublicProfileLayout(props: LayoutProps<'/[locale]/profile/[slug]'>) {
  return (
    <main className="container py-8">
      <div className="mx-auto grid max-w-6xl gap-12">
        <Suspense fallback={<Loading />}>
          <PublicProfileLayoutContent {...props} />
        </Suspense>
      </div>
    </main>
  )
}
