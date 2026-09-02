import { inArray, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { GLOBAL_ACTIVITY_MAX_OFFSET, GLOBAL_ACTIVITY_PAGE_SIZE, type GlobalActivityItem } from '@/lib/activity/global'
import { loadAllowedMarketCreatorWallets } from '@/lib/allowed-market-creators-server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { getDataApiUrl } from '@/lib/data-api/client'
import { mapDataApiActivityToActivityOrder, type DataApiActivity } from '@/lib/data-api/user'
import { events, markets } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'

interface ActivityMarketMetadata {
  creator: string | null
  categoryTags: string[]
}

interface ActivityEventRow {
  id: string
  eventTags: Array<{ tag: { slug: string } | null }>
}

function normalizeWalletAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

function normalizeConditionId(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

async function loadActivityMarketMetadata(conditionIds: string[]) {
  if (conditionIds.length === 0) {
    return new Map<string, ActivityMarketMetadata>()
  }

  const rows = await db.query.markets.findMany({
    where: inArray(sql<string>`LOWER(${markets.condition_id})`, conditionIds),
    columns: {
      condition_id: true,
      event_id: true,
    },
    with: {
      condition: {
        columns: {
          creator: true,
        },
      },
    },
  })

  const eventIds = [...new Set(rows.map((row) => row.event_id))]
  const eventRows =
    eventIds.length === 0
      ? []
      : ((await db.query.events.findMany({
          where: inArray(events.id, eventIds),
          columns: {
            id: true,
          },
          with: {
            eventTags: {
              with: {
                tag: {
                  columns: {
                    slug: true,
                  },
                },
              },
            },
          },
        })) as ActivityEventRow[])
  const eventTagsById = new Map(
    eventRows.map((event) => [
      event.id,
      event.eventTags.flatMap((eventTag) => (eventTag.tag?.slug ? [eventTag.tag.slug] : [])),
    ]),
  )

  return new Map(
    rows.map((row) => [
      row.condition_id.toLowerCase(),
      {
        creator: row.condition?.creator ?? null,
        categoryTags: eventTagsById.get(row.event_id) ?? [],
      },
    ]),
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedLimit = parsePositiveInteger(searchParams.get('limit'), GLOBAL_ACTIVITY_PAGE_SIZE)
  const requestedOffset = parseNonNegativeInteger(searchParams.get('offset'), 0)
  const limit = Math.min(requestedLimit, GLOBAL_ACTIVITY_PAGE_SIZE)
  const offset = Math.min(requestedOffset, GLOBAL_ACTIVITY_MAX_OFFSET)

  try {
    const { data: allowedCreators, error: allowedCreatorsError } = await loadAllowedMarketCreatorWallets()
    if (allowedCreatorsError || !allowedCreators) {
      throw new Error(allowedCreatorsError ?? 'Failed to load allowed market creators.')
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      takerOnly: 'true',
    })
    const response = await fetch(`${getDataApiUrl()}/trades?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Data API activity request failed (${response.status}).`)
    }

    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) {
      throw new Error('Unexpected response from data service.')
    }

    const activities = payload as DataApiActivity[]
    const conditionIds = activities
      .map((activity) => normalizeConditionId(activity.conditionId))
      .filter((conditionId): conditionId is string => conditionId !== null)
    const metadataByCondition = await loadActivityMarketMetadata([...new Set(conditionIds)])
    const allowedCreatorSet = new Set(allowedCreators.map((creator) => normalizeWalletAddress(creator)).filter(Boolean))

    const items: GlobalActivityItem[] = []
    for (const activity of activities) {
      const conditionId = normalizeConditionId(activity.conditionId)
      if (!conditionId) {
        continue
      }

      const metadata = metadataByCondition.get(conditionId)
      const creator = normalizeWalletAddress(metadata?.creator)
      if (!metadata || !creator || !allowedCreatorSet.has(creator)) {
        continue
      }

      const order = mapDataApiActivityToActivityOrder(activity)
      items.push({
        id: order.id,
        categoryTags: metadata.categoryTags,
        order,
      })
    }

    const hasMore = activities.length === limit && offset + limit < GLOBAL_ACTIVITY_MAX_OFFSET
    return NextResponse.json(
      {
        items,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Failed to load global activity', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
