'use cache'

import type { Metadata } from 'next'
import {
  generateSportsVerticalEventMetadata,
  renderSportsVerticalEventPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-event-page'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER, event: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sports/[sport]/[event]'>): Promise<Metadata> {
  return await generateSportsVerticalEventMetadata(await params)
}

export default async function SportsEventPage({
  params,
}: PageProps<'/[locale]/sports/[sport]/[event]'>) {
  return await renderSportsVerticalEventPage({
    ...(await params),
    vertical: 'sports',
  })
}
