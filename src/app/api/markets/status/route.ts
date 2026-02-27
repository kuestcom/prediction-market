import { inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { markets } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'

function normalizeConditionId(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.toLowerCase()
}

function resolveConditionIds(input: unknown) {
  if (!Array.isArray(input)) {
    return []
  }

  const normalizedIds = new Set<string>()
  input.forEach((value) => {
    const normalized = normalizeConditionId(value)
    if (!normalized) {
      return
    }
    normalizedIds.add(normalized)
  })

  return Array.from(normalizedIds).slice(0, 500)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const conditionIds = resolveConditionIds(body?.conditionIds)

    if (conditionIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const rows = await db.query.markets.findMany({
      where: inArray(markets.condition_id, conditionIds),
      columns: {
        condition_id: true,
        is_resolved: true,
      },
    })

    const data = rows.map(row => ({
      condition_id: row.condition_id.toLowerCase(),
      is_resolved: Boolean(row.is_resolved),
    }))

    return NextResponse.json({ data })
  }
  catch (error) {
    console.error('Failed to load market status by condition ids.', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
