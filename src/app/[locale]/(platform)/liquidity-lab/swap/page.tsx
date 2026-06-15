import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import LiquidityLabClient from '@/app/[locale]/(platform)/liquidity-lab/_components/LiquidityLabClient'
import { withLocalePrefix } from '@/lib/locale-path'

export const metadata: Metadata = {
  title: 'Liquidity Lab',
}

interface LiquidityLabSwapPageProps {
  params: Promise<{
    locale: string
  }>
  searchParams?: Promise<{
    pool?: string
  }>
}

export default async function LiquidityLabSwapPage({
  params,
  searchParams,
}: LiquidityLabSwapPageProps) {
  const { locale } = await params
  const query: { pool?: string } = searchParams ? await searchParams : {}
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  const basePath = withLocalePrefix('/liquidity-lab', resolvedLocale)

  return (
    <Suspense fallback={null}>
      <LiquidityLabClient
        basePath={basePath}
        initialPoolSlug={query.pool}
        initialPools={[]}
        surface="swap"
      />
    </Suspense>
  )
}
