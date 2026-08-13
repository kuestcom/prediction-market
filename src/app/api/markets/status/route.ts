import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { loadAllowedMarketCreatorWallets } from '@/lib/allowed-market-creators-server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { events, markets } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { resolveEventMarketPath } from '@/lib/events-routing'

const MAX_CONDITION_IDS = 200
const MAX_REQUEST_BYTES = 32 * 1024
const MAX_RESPONSE_BYTES = 256 * 1024
const CONDITION_ID_PATTERN = /^0x[0-9a-f]{64}$/i

interface MarketStatusRow {
  condition_id: string
  slug: string
  metadata: string | null
  is_active: boolean
  is_resolved: boolean
  condition: { creator: string | null; resolved: boolean | null } | null
  event: {
    slug: string
    is_hidden: boolean
    status: string
    sports: {
      sports_sport_slug: string | null
      sports_league_slug: string | null
      sports_event_slug: string | null
    } | null
    eventTags: Array<{
      tag: { slug: string; is_main_category: boolean | null; hide_events: boolean } | null
    }>
  } | null
}

interface EventStatusRow extends NonNullable<MarketStatusRow['event']> {
  markets: Array<Omit<MarketStatusRow, 'event'>>
}

function normalizeConditionId(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return CONDITION_ID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null
}

export function resolveConditionIds(input: unknown) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_CONDITION_IDS) {
    return null
  }

  const normalized = input.map(normalizeConditionId)
  return normalized.every((conditionId): conditionId is string => conditionId !== null) ? normalized : null
}

function parseMarketMetadata(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function readBoolean(metadata: Record<string, unknown> | null, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return fallback
}

function resolveMarketDirectPath(row: MarketStatusRow) {
  const event = row.event
  if (!event?.slug || !row.slug) {
    return null
  }

  const tags = event.eventTags
    .map((eventTag) => eventTag.tag)
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag?.slug))
  const mainTag = tags.find((tag) => tag.is_main_category)?.slug ?? null
  const tagSlugs = tags.map((tag) => ({ slug: tag.slug }))
  const hasPropsTag = tagSlugs.some((tag) => tag.slug === 'props' || tag.slug === 'prop')
  const hasGamesTag = tagSlugs.some((tag) => tag.slug === 'games' || tag.slug === 'game')

  return resolveEventMarketPath(
    {
      slug: event.slug,
      main_tag: mainTag,
      sports_sport_slug: event.sports?.sports_sport_slug ?? null,
      sports_league_slug: event.sports?.sports_league_slug ?? null,
      sports_event_slug: event.sports?.sports_event_slug ?? null,
      sports_section: hasPropsTag ? 'props' : hasGamesTag ? 'games' : null,
      tags: tagSlugs,
    },
    row.slug,
  )
}

export function isMarketNotificationEligible(row: MarketStatusRow, allowedCreators: ReadonlySet<string>) {
  const metadata = parseMarketMetadata(row.metadata)
  const creator = row.condition?.creator?.trim().toLowerCase() ?? ''
  const event = row.event
  const hasHiddenTag = event?.eventTags.some((eventTag) => Boolean(eventTag.tag?.hide_events)) ?? true

  return Boolean(
    creator &&
    allowedCreators.has(creator) &&
    event &&
    !event.is_hidden &&
    event.status.trim().toLowerCase() === 'active' &&
    !hasHiddenTag &&
    row.is_active &&
    !row.is_resolved &&
    !row.condition?.resolved &&
    !readBoolean(metadata, ['archived'], false) &&
    readBoolean(metadata, ['acceptingOrders', 'accepting_orders'], true),
  )
}

async function loadMarketStatusRows(conditionIds: string[]): Promise<MarketStatusRow[]> {
  const uniqueConditionIds = [...new Set(conditionIds)]
  return await db.transaction(async (transaction) => {
    await transaction.execute(sql`SET LOCAL statement_timeout = '5s'`)
    const eventRows = (await transaction.query.events.findMany({
      where: exists(
        transaction
          .select({ conditionId: markets.condition_id })
          .from(markets)
          .where(and(eq(markets.event_id, events.id), inArray(markets.condition_id, uniqueConditionIds))),
      ),
      with: {
        markets: {
          where: inArray(markets.condition_id, uniqueConditionIds),
          columns: {
            condition_id: true,
            slug: true,
            metadata: true,
            is_active: true,
            is_resolved: true,
          },
          with: {
            condition: {
              columns: {
                creator: true,
                resolved: true,
              },
            },
          },
        },
        sports: {
          columns: {
            sports_sport_slug: true,
            sports_league_slug: true,
            sports_event_slug: true,
          },
        },
        eventTags: {
          with: {
            tag: {
              columns: {
                slug: true,
                is_main_category: true,
                hide_events: true,
              },
            },
          },
        },
      },
    })) as unknown as EventStatusRow[]

    return eventRows.flatMap((event) =>
      event.markets.map((market) => ({
        ...market,
        event: {
          slug: event.slug,
          is_hidden: event.is_hidden,
          status: event.status,
          sports: event.sports,
          eventTags: event.eventTags,
        },
      })),
    )
  })
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
    }

    const body = await request.json().catch(() => null)
    const conditionIds = resolveConditionIds(body?.conditionIds)
    if (!conditionIds) {
      return NextResponse.json(
        { error: `conditionIds must contain between 1 and ${MAX_CONDITION_IDS} valid condition IDs.` },
        { status: 400 },
      )
    }

    const [rows, creatorsResult] = await Promise.all([
      loadMarketStatusRows(conditionIds),
      loadAllowedMarketCreatorWallets(),
    ])
    if (creatorsResult.error || !creatorsResult.data) {
      throw new Error(creatorsResult.error ?? 'Failed to load allowed market creators.')
    }

    const allowedCreators = new Set(creatorsResult.data.map((wallet) => wallet.toLowerCase()))
    const rowsByConditionId = new Map(rows.map((row) => [row.condition_id.toLowerCase(), row]))
    const data = conditionIds.map((conditionId) => {
      const row = rowsByConditionId.get(conditionId)
      if (!row) {
        return {
          condition_id: conditionId,
          is_resolved: false,
          notification_eligible: false,
          direct_path: null,
        }
      }

      const notificationEligible = isMarketNotificationEligible(row, allowedCreators)
      return {
        condition_id: conditionId,
        is_resolved: Boolean(row.is_resolved || row.condition?.resolved),
        notification_eligible: notificationEligible,
        direct_path: notificationEligible ? resolveMarketDirectPath(row) : null,
      }
    })

    const responseBody = JSON.stringify({ data })
    if (new TextEncoder().encode(responseBody).byteLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return new NextResponse(responseBody, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Failed to load market status by condition ids.', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
