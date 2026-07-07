'use cache'

import type { Metadata } from 'next'
import {
  generateSportsVerticalEventMarketMetadata,
  renderSportsVerticalEventMarketPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-event-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return getPublicShellStaticParams({ market: STATIC_PARAMS_PLACEHOLDER })
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sports/[sport]/[event]/[market]'>): Promise<Metadata> {
  const { locale, sport, event, market } = await params

  return await generateSportsVerticalEventMarketMetadata({
    locale,
    sport,
    event,
    market,
  })
}

export default async function SportsEventMarketPage({
  params,
}: PageProps<'/[locale]/sports/[sport]/[event]/[market]'>) {
  const { locale, sport, event, market } = await params

  return await renderSportsVerticalEventMarketPage({
    locale,
    sport,
    event,
    market,
    vertical: 'sports',
  })
}
