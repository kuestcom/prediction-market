import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import LiquidityLabClient from '@/app/[locale]/(platform)/liquidity-lab/_components/LiquidityLabClient'
import { withLocalePrefix } from '@/lib/locale-path'

export const metadata: Metadata = {
  title: 'Liquidity Lab',
}

export default async function LiquidityLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  const basePath = withLocalePrefix('/liquidity-lab', resolvedLocale)

  return (
    <Suspense fallback={null}>
      <LiquidityLabClient basePath={basePath} initialPools={[]} surface="pools" />
    </Suspense>
  )
}
