import type { Metadata } from 'next'

import {
  generateSportsVerticalEventMetadata,
  renderSportsVerticalEventPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-event-page'
import { getPublicShellStaticParams, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const instant = false

export async function generateStaticParams() {
  return getPublicShellStaticParams({ sport: STATIC_PARAMS_PLACEHOLDER, event: STATIC_PARAMS_PLACEHOLDER })
}

export async function generateMetadata({ params }: PageProps<'/[locale]/sports/[sport]/[event]'>): Promise<Metadata> {
  'use cache'

  const { sport, event } = await params
  return await generateSportsVerticalEventMetadata({ sport, event })
}

async function CachedSportsEventPageContent({ sport, event }: { sport: string; event: string }) {
  'use cache'

  return await renderSportsVerticalEventPage({
    sport,
    event,
    vertical: 'sports',
  })
}

export default async function SportsEventPage({ params }: PageProps<'/[locale]/sports/[sport]/[event]'>) {
  const { sport, event } = await params

  return <CachedSportsEventPageContent sport={sport} event={event} />
}
