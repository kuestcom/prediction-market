import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { buildEmbedMarket, withEmbedCors } from '@/app/api/embed/_utils'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { markets } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'

export async function OPTIONS() {
  return withEmbedCors(new NextResponse(null, { status: 204 }))
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const marketRecord = await db.query.markets.findFirst({
      where: eq(markets.slug, slug),
      with: {
        event: {
          columns: {
            slug: true,
          },
        },
      },
    })

    if (!marketRecord?.event?.slug) {
      return withEmbedCors(NextResponse.json({ error: 'Market not found' }, { status: 404 }))
    }

    const { data: event, error } = await EventRepository.getEventBySlug(marketRecord.event.slug)
    if (error || !event) {
      return withEmbedCors(NextResponse.json({ error: 'Market not found' }, { status: 404 }))
    }

    const market = event.markets.find((item) => item.slug === slug)
    if (!market) {
      return withEmbedCors(NextResponse.json({ error: 'Market not found' }, { status: 404 }))
    }

    return withEmbedCors(NextResponse.json(buildEmbedMarket(market, event)))
  } catch (error) {
    console.error('Embed market API error:', error)
    return withEmbedCors(NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 }))
  }
}
