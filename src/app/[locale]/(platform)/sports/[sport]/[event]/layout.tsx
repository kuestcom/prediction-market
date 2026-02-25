import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER, event: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsEventLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string, sport: string, event: string }>
  children: ReactNode
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <div className="pt-5 pb-20 min-[1200px]:h-full min-[1200px]:min-h-0 md:pb-0">{children}</div>
}
