import type { Metadata } from 'next'
import {
  generateSportsVerticalEventMetadata,
  renderSportsVerticalEventPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-event-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return getPublicShellStaticParams({ sport: STATIC_PARAMS_PLACEHOLDER, event: STATIC_PARAMS_PLACEHOLDER })
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sports/[sport]/[event]'>): Promise<Metadata> {
  return await generateSportsVerticalEventMetadata(await params)
}

async function CachedSportsEventPageContent({
  locale,
  sport,
  event,
}: {
  locale: string
  sport: string
  event: string
}) {
  'use cache'

  return await renderSportsVerticalEventPage({
    locale,
    sport,
    event,
    vertical: 'sports',
  })
}

export default async function SportsEventPage({
  params,
}: PageProps<'/[locale]/sports/[sport]/[event]'>) {
  const { locale, sport, event } = await params

  return <CachedSportsEventPageContent locale={locale} sport={sport} event={event} />
}
