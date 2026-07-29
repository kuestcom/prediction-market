import { NextResponse } from 'next/server'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'

function normalizeId(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const conditionId = searchParams.get('conditionId')?.trim()

  if (!conditionId) {
    return NextResponse.json({ error: 'Missing conditionId.' }, { status: 400 })
  }

  try {
    const { data, error } = await EventRepository.getEventMarketMetadata(slug)
    if (error) {
      throw error
    }

    const normalizedConditionId = normalizeId(conditionId)
    const market = (data ?? []).find((item) => normalizeId(item.condition_id) === normalizedConditionId) ?? null

    return NextResponse.json({ data: market })
  } catch (error) {
    console.error('Failed to load market metadata.', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Event not found')) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
