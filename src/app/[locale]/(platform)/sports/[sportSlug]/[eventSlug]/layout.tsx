import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'

export default async function SportsEventLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>
  children: ReactNode
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container grid min-h-screen gap-8 pb-12 lg:grid-cols-[minmax(0,3fr)_21.25rem]">
      <div className="pt-5 pb-20 md:pb-0">{children}</div>

      <aside
        id="event-order-panel"
        className={`
          hidden gap-4
          lg:sticky lg:top-38 lg:grid lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto
        `}
      />
    </main>
  )
}
