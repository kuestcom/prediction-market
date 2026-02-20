import { and, eq, inArray, lt, ne, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { SettingsRepository } from '@/lib/db/queries/settings'
import {
  conditions as conditionsTable,
  events as eventsTable,
  event_tags as eventTagsTable,
  markets as marketsTable,
  outcomes as outcomesTable,
  subgraph_syncs,
  tags as tagsTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { uploadPublicAsset } from '@/lib/supabase'

export const maxDuration = 300

const PNL_SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmfbr456t4gud01w483uu2d9d/subgraphs/pnl-subgraph/1.0.0/gn'
const IRYS_GATEWAY = process.env.IRYS_GATEWAY || 'https://gateway.irys.xyz'
const SYNC_TIME_LIMIT_MS = 250_000
const SYNC_RUNNING_STALE_MS = 15 * 60 * 1000
const PNL_PAGE_SIZE = 200
const GENERAL_SETTINGS_GROUP = 'general'
const GENERAL_MARKET_CREATORS_KEY = 'market_creators'
const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

interface SyncCursor {
  conditionId: string
  updatedAt: number
}

interface SubgraphCondition {
  id: string
  oracle: string | null
  questionId: string | null
  resolved: boolean
  metadataHash: string | null
  creator: string | null
  creationTimestamp: string
  updatedAt: string
}

interface MarketTimestamps {
  createdAtIso: string
  updatedAtIso: string
}

interface SyncStats {
  fetchedCount: number
  processedCount: number
  skippedCreatorCount: number
  errors: { conditionId: string, error: string }[]
  timeLimitReached: boolean
}

async function getAllowedCreators(): Promise<string[]> {
  const fixedCreators = [
    '0x1FD81E09dA67D84f02DB0c0eBabd5a217D1B928d', // Polymarket cloned markets on Amoy
  ]
  const fixedCreatorsNormalized = fixedCreators.map(addr => addr.toLowerCase())

  const { data: allSettings, error } = await SettingsRepository.getSettings()
  if (error) {
    return [...new Set(fixedCreatorsNormalized)]
  }

  const rawCreators = allSettings?.[GENERAL_SETTINGS_GROUP]?.[GENERAL_MARKET_CREATORS_KEY]?.value ?? ''
  const parsedCreators = rawCreators
    .split(/[\n,]+/)
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0)

  const validCreators: string[] = []
  const invalidCreators: string[] = []

  for (const creator of parsedCreators) {
    if (WALLET_ADDRESS_PATTERN.test(creator)) {
      validCreators.push(creator.toLowerCase())
    }
    else {
      invalidCreators.push(creator)
    }
  }

  if (invalidCreators.length > 0) {
    console.error(
      `Invalid market creator addresses in settings: ${invalidCreators.join(', ')}`,
    )
  }

  return [...new Set([...fixedCreatorsNormalized, ...validCreators])]
}
/**
 * 🔄 Market Synchronization Script for Vercel Functions
 *
 * This function syncs prediction markets from the Goldsky PnL subgraph:
 * - Fetches new markets from blockchain via subgraph (INCREMENTAL)
 * - Downloads metadata and images from Irys
 * - Stores everything in database and configured object storage
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const lockAcquired = await tryAcquireSyncLock()
    if (!lockAcquired) {
      console.log('🚫 Sync already running, skipping...')
      return NextResponse.json({
        success: false,
        message: 'Sync already running',
        skipped: true,
      }, { status: 409 })
    }

    console.log('🚀 Starting incremental market synchronization...')

    const lastCursor = await getLastPnLCursor()
    if (lastCursor) {
      console.log(
        `📊 Last PnL cursor: ${lastCursor.conditionId} @ ${new Date(lastCursor.updatedAt * 1000).toISOString()}`,
      )
    }
    else {
      console.log('📊 Last PnL cursor: none (full scan from subgraph start)')
    }

    const allowedCreators = new Set(await getAllowedCreators())
    const syncResult = await syncMarkets(allowedCreators)

    await updateSyncStatus('completed', null, syncResult.processedCount)

    if (syncResult.fetchedCount === 0) {
      console.log('📭 No markets fetched from PnL subgraph')
      return NextResponse.json({
        success: true,
        message: 'No new markets to process',
        processed: 0,
        fetched: 0,
      })
    }

    const responsePayload = {
      success: true,
      processed: syncResult.processedCount,
      fetched: syncResult.fetchedCount,
      skippedCreators: syncResult.skippedCreatorCount,
      errors: syncResult.errors.length,
      errorDetails: syncResult.errors,
      timeLimitReached: syncResult.timeLimitReached,
    }

    console.log('🎉 Incremental synchronization completed:', responsePayload)
    return NextResponse.json(responsePayload)
  }
  catch (error: any) {
    console.error('💥 Sync failed:', error)

    await updateSyncStatus('error', error.message)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}

async function syncMarkets(allowedCreators: Set<string>): Promise<SyncStats> {
  const syncStartedAt = Date.now()
  let cursor = await getLastPnLCursor()

  if (cursor) {
    const cursorIso = new Date(cursor.updatedAt * 1000).toISOString()
    console.log(`⏱️ Resuming sync after condition ${cursor.conditionId} (updated at ${cursorIso})`)
  }
  else {
    console.log('📥 No existing markets found, starting full sync')
  }

  let fetchedCount = 0
  let processedCount = 0
  let skippedCreatorCount = 0
  const errors: { conditionId: string, error: string }[] = []
  let timeLimitReached = false
  const eventIdsNeedingStatusUpdate = new Set<string>()

  while (Date.now() - syncStartedAt < SYNC_TIME_LIMIT_MS) {
    const page = await fetchPnLConditionsPage(cursor)

    if (page.conditions.length === 0) {
      console.log('📦 PnL subgraph returned no additional conditions')
      break
    }

    fetchedCount += page.conditions.length
    console.log(`📑 Processing ${page.conditions.length} conditions (running total fetched: ${fetchedCount})`)

    let lastPersistableCursor: SyncCursor | null = null

    for (const condition of page.conditions) {
      const updatedAt = Number(condition.updatedAt)
      if (Number.isNaN(updatedAt)) {
        console.error(`⚠️ Skipping condition ${condition.id} - invalid updatedAt: ${condition.updatedAt}`)
        continue
      }

      const conditionCursor: SyncCursor = {
        conditionId: condition.id,
        updatedAt,
      }

      if (!condition.creator) {
        console.error(`⚠️ Skipping condition ${condition.id} - missing creator field`)
        lastPersistableCursor = conditionCursor
        continue
      }

      const creatorAddress = condition.creator.toLowerCase()
      if (!allowedCreators.has(creatorAddress)) {
        skippedCreatorCount++
        console.log(`🚫 Skipping market ${condition.id} - creator ${condition.creator} not in allowed list`)
        lastPersistableCursor = conditionCursor
        continue
      }

      if (Date.now() - syncStartedAt >= SYNC_TIME_LIMIT_MS) {
        console.warn('⏹️ Time limit reached during market processing, aborting sync loop')
        timeLimitReached = true
        break
      }

      try {
        const eventIdForStatusUpdate = await processMarket(condition)
        if (eventIdForStatusUpdate) {
          eventIdsNeedingStatusUpdate.add(eventIdForStatusUpdate)
        }
        processedCount++
        lastPersistableCursor = conditionCursor
        console.log(`✅ Processed market: ${condition.id}`)
      }
      catch (error: any) {
        console.error(`❌ Error processing market ${condition.id}:`, error)
        errors.push({
          conditionId: condition.id,
          error: error.message ?? String(error),
        })
        // Prevent a single malformed condition from blocking future pages forever.
        lastPersistableCursor = conditionCursor
      }
    }

    if (lastPersistableCursor) {
      await updatePnLCursor(lastPersistableCursor)
      cursor = lastPersistableCursor
    }
    else if (!timeLimitReached) {
      // Avoid stalling forever if an entire page cannot be processed.
      const lastConditionInPage = page.conditions[page.conditions.length - 1]
      const pageEndTimestamp = Number(lastConditionInPage?.updatedAt)
      if (!lastConditionInPage || Number.isNaN(pageEndTimestamp)) {
        break
      }
      const pageEndCursor = {
        updatedAt: pageEndTimestamp,
        conditionId: lastConditionInPage.id,
      }
      await updatePnLCursor(pageEndCursor)
      cursor = pageEndCursor
    }

    if (eventIdsNeedingStatusUpdate.size > 0) {
      await updateEventStatusesFromMarketsBatch(Array.from(eventIdsNeedingStatusUpdate))
      eventIdsNeedingStatusUpdate.clear()
    }

    if (timeLimitReached) {
      break
    }

    if (page.conditions.length < PNL_PAGE_SIZE) {
      console.log('📭 Last fetched page was smaller than the configured page size; stopping pagination')
      break
    }
  }

  if (eventIdsNeedingStatusUpdate.size > 0) {
    await updateEventStatusesFromMarketsBatch(Array.from(eventIdsNeedingStatusUpdate))
    eventIdsNeedingStatusUpdate.clear()
  }

  return {
    fetchedCount,
    processedCount,
    skippedCreatorCount,
    errors,
    timeLimitReached,
  }
}

async function getLastPnLCursor(): Promise<SyncCursor | null> {
  const rows = await db
    .select({
      cursor_updated_at: subgraph_syncs.cursor_updated_at,
      cursor_id: subgraph_syncs.cursor_id,
    })
    .from(subgraph_syncs)
    .where(and(
      eq(subgraph_syncs.service_name, 'market_sync'),
      eq(subgraph_syncs.subgraph_name, 'pnl'),
    ))
    .limit(1)
  const data = rows[0]

  if (!data?.cursor_updated_at || !data?.cursor_id) {
    return null
  }

  const updatedAt = Number(data.cursor_updated_at)
  if (Number.isNaN(updatedAt)) {
    return null
  }

  return {
    conditionId: data.cursor_id,
    updatedAt,
  }
}

async function updatePnLCursor(cursor: SyncCursor) {
  try {
    const payload = {
      service_name: 'market_sync',
      subgraph_name: 'pnl',
      cursor_updated_at: BigInt(cursor.updatedAt),
      cursor_id: cursor.conditionId,
    }

    await db
      .insert(subgraph_syncs)
      .values(payload)
      .onConflictDoUpdate({
        target: [subgraph_syncs.service_name, subgraph_syncs.subgraph_name],
        set: payload,
      })
  }
  catch (error) {
    console.error('Failed to update market sync cursor:', error)
  }
}

async function fetchPnLConditionsPage(afterCursor: SyncCursor | null): Promise<{ conditions: SubgraphCondition[] }> {
  const cursorUpdatedAt = afterCursor?.updatedAt
  const cursorConditionId = afterCursor?.conditionId

  let whereClause = ''
  if (cursorUpdatedAt !== undefined && cursorConditionId !== undefined) {
    const timestampLiteral = JSON.stringify(cursorUpdatedAt.toString())
    const conditionIdLiteral = JSON.stringify(cursorConditionId)
    whereClause = `, where: { or: [{ updatedAt_gt: ${timestampLiteral} }, { updatedAt: ${timestampLiteral}, id_gt: ${conditionIdLiteral} }] }`
  }

  const query = `
    {
      conditions(
        first: ${PNL_PAGE_SIZE},
        orderBy: updatedAt,
        orderDirection: asc${whereClause}
      ) {
        id
        oracle
        questionId
        resolved
        metadataHash
        creator
        creationTimestamp
        updatedAt
      }
    }
  `

  const response = await fetch(PNL_SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`PnL subgraph request failed: ${response.statusText}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(`PnL subgraph query error: ${result.errors[0].message}`)
  }

  const rawConditions: SubgraphCondition[] = result.data.conditions || []

  const normalizedConditions: SubgraphCondition[] = rawConditions.map(condition => ({
    ...condition,
    creator: condition.creator ? condition.creator.toLowerCase() : condition.creator,
  }))

  return { conditions: normalizedConditions }
}

async function processMarket(market: SubgraphCondition) {
  const timestamps = getMarketTimestamps(market)
  await processCondition(market, timestamps)
  if (!market.metadataHash) {
    throw new Error(`Market ${market.id} missing required metadataHash field`)
  }
  const metadata = await fetchMetadata(market.metadataHash)
  const eventId = await processEvent(
    metadata.event,
    market.creator!,
    timestamps.createdAtIso,
  )
  return await processMarketData(market, metadata, eventId, timestamps)
}

async function fetchMetadata(metadataHash: string) {
  const url = `${IRYS_GATEWAY}/${metadataHash}`

  const response = await fetch(url, {
    keepalive: true,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata from ${url}: ${response.statusText}`)
  }

  const metadata = await response.json()

  if (!metadata.name || !metadata.slug || !metadata.event) {
    throw new Error(`Invalid metadata: missing required fields. Got: ${JSON.stringify(Object.keys(metadata))}`)
  }

  return metadata
}

async function processCondition(market: SubgraphCondition, timestamps: MarketTimestamps) {
  if (!market.oracle) {
    throw new Error(`Market ${market.id} missing required oracle field`)
  }

  if (!market.questionId) {
    throw new Error(`Market ${market.id} missing required questionId field`)
  }

  if (!market.creator) {
    throw new Error(`Market ${market.id} missing required creator field`)
  }

  if (!market.metadataHash) {
    throw new Error(`Market ${market.id} missing required metadataHash field`)
  }

  const payload = {
    id: market.id,
    oracle: market.oracle,
    question_id: market.questionId,
    resolved: market.resolved,
    metadata_hash: market.metadataHash,
    creator: market.creator!,
    created_at: new Date(timestamps.createdAtIso),
    updated_at: new Date(timestamps.updatedAtIso),
  }

  await db
    .insert(conditionsTable)
    .values(payload)
    .onConflictDoUpdate({
      target: [conditionsTable.id],
      set: payload,
    })

  console.log(`Processed condition: ${market.id}`)
}

function normalizeTimestamp(rawValue: unknown): string | null {
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim()
    if (trimmed) {
      const parsed = new Date(trimmed)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    }
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    // Handle Unix seconds or milliseconds
    const timestamp = rawValue > 10_000_000_000 ? rawValue : rawValue * 1000
    const parsed = new Date(timestamp)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return null
}

async function processEvent(eventData: any, creatorAddress: string, createdAtIso: string) {
  if (!eventData || !eventData.slug || !eventData.title) {
    throw new Error(`Invalid event data: ${JSON.stringify(eventData)}`)
  }

  const eventSlug = String(eventData.slug).trim()
  if (!eventSlug) {
    throw new Error(`Invalid event slug: ${eventData.slug}`)
  }

  const normalizedEventTitle = String(eventData.title).trim()
  if (!normalizedEventTitle) {
    throw new Error(`Invalid event title for slug ${eventSlug}`)
  }

  const normalizedEndDate = normalizeTimestamp(eventData.end_time)
  const enableNegRiskFlag = normalizeBooleanField(eventData.enable_neg_risk)
  const negRiskAugmentedFlag = normalizeBooleanField(eventData.neg_risk_augmented)
  const eventNegRiskFlag = normalizeBooleanField(eventData.neg_risk)
  const eventNegRiskMarketId = normalizeHexField(eventData.neg_risk_market_id)
  const eventSeriesSlug = normalizeStringField(eventData.series_slug)
  const eventSeriesId = normalizeStringField(eventData.series_id)
  const eventSeriesRecurrence = normalizeStringField(eventData.series_recurrence)
    ?? normalizeStringField(eventData.recurrence)

  const existingEventRows = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      end_date: eventsTable.end_date,
      created_at: eventsTable.created_at,
    })
    .from(eventsTable)
    .where(eq(eventsTable.slug, eventSlug))
    .limit(1)
  const existingEvent = existingEventRows[0]

  if (existingEvent) {
    const updatePayload: Record<string, any> = {
      enable_neg_risk: enableNegRiskFlag,
      neg_risk_augmented: negRiskAugmentedFlag,
      neg_risk: eventNegRiskFlag,
      neg_risk_market_id: eventNegRiskMarketId ?? null,
      series_slug: eventSeriesSlug ?? null,
      series_id: eventSeriesId ?? null,
      series_recurrence: eventSeriesRecurrence ?? null,
    }

    if (existingEvent.title !== normalizedEventTitle) {
      updatePayload.title = normalizedEventTitle
    }

    const existingCreatedAtMs = existingEvent.created_at
      ? new Date(existingEvent.created_at).getTime()
      : Number.NaN
    const incomingCreatedAtMs = Date.parse(createdAtIso)
    if (!Number.isNaN(incomingCreatedAtMs)
      && (Number.isNaN(existingCreatedAtMs) || incomingCreatedAtMs < existingCreatedAtMs)) { updatePayload.created_at = new Date(createdAtIso) }

    const existingEndDateIso = existingEvent.end_date?.toISOString() ?? null
    if (normalizedEndDate && normalizedEndDate !== existingEndDateIso) {
      updatePayload.end_date = new Date(normalizedEndDate)
    }

    try {
      await db
        .update(eventsTable)
        .set(updatePayload)
        .where(eq(eventsTable.id, existingEvent.id))
    }
    catch (updateError) {
      console.error(`Failed to update event ${existingEvent.id}:`, updateError)
    }

    console.log(`Event ${eventSlug} already exists, using existing ID: ${existingEvent.id}`)
    return existingEvent.id
  }

  let iconUrl: string | null = null
  if (eventData.icon) {
    const eventIconSlug = normalizeStorageSlug(
      eventSlug,
      `${eventData.title ?? 'event'}:${creatorAddress}`,
    )
    iconUrl = await downloadAndSaveImage(eventData.icon, `events/icons/${eventIconSlug}`)
  }

  console.log(`Creating new event: ${eventSlug} by creator: ${creatorAddress}`)

  const newEventRows = await db
    .insert(eventsTable)
    .values({
      slug: eventSlug,
      title: normalizedEventTitle,
      creator: creatorAddress,
      icon_url: iconUrl,
      show_market_icons: eventData.show_market_icons !== false,
      enable_neg_risk: enableNegRiskFlag,
      neg_risk_augmented: negRiskAugmentedFlag,
      neg_risk: eventNegRiskFlag,
      neg_risk_market_id: eventNegRiskMarketId ?? null,
      series_slug: eventSeriesSlug ?? null,
      series_id: eventSeriesId ?? null,
      series_recurrence: eventSeriesRecurrence ?? null,
      rules: eventData.rules || null,
      end_date: normalizedEndDate ? new Date(normalizedEndDate) : null,
      created_at: new Date(createdAtIso),
    })
    .returning({ id: eventsTable.id })
  const newEvent = newEventRows[0]

  if (!newEvent?.id) {
    throw new Error(`Event creation failed: no ID returned`)
  }

  console.log(`Created event ${eventSlug} with ID: ${newEvent.id}`)

  if (eventData.tags?.length > 0) {
    await processTags(newEvent.id, eventData.tags)
  }

  return newEvent.id
}

async function processMarketData(
  market: SubgraphCondition,
  metadata: any,
  eventId: string,
  timestamps: MarketTimestamps,
) {
  if (!eventId) {
    throw new Error(`Invalid eventId: ${eventId}. Event must be created first.`)
  }

  const existingMarketRows = await db
    .select({
      condition_id: marketsTable.condition_id,
      event_id: marketsTable.event_id,
    })
    .from(marketsTable)
    .where(eq(marketsTable.condition_id, market.id))
    .limit(1)
  const existingMarket = existingMarketRows[0]

  const marketAlreadyExists = Boolean(existingMarket)
  const eventIdForStatusUpdate = existingMarket?.event_id ?? eventId

  if (marketAlreadyExists) {
    console.log(`Market ${market.id} already exists, updating cached data...`)
  }

  let iconUrl: string | null = null
  if (metadata.icon) {
    const marketIconSlug = normalizeStorageSlug(
      metadata.slug,
      market.id,
    )
    iconUrl = await downloadAndSaveImage(metadata.icon, `markets/icons/${marketIconSlug}`)
  }

  console.log(`${marketAlreadyExists ? 'Updating' : 'Creating'} market ${market.id} with eventId: ${eventId}`)

  if (!market.oracle) {
    throw new Error(`Market ${market.id} missing required oracle field`)
  }

  const question = normalizeStringField(metadata.question)
  const marketRules = normalizeStringField(metadata.market_rules)
  const resolutionSource = normalizeStringField(metadata.resolution_source)
  const resolutionSourceUrl = normalizeStringField(metadata.resolution_source_url)
  const resolutionAdapterAddress = normalizeAddressField(metadata.resolution_adapter_address)
  const resolverAddress = normalizeAddressField(metadata.resolver) ?? resolutionAdapterAddress
  const negRiskFlag = normalizeBooleanField(metadata.neg_risk)
  const negRiskOtherFlag = normalizeBooleanField(metadata.neg_risk_other)
  const negRiskMarketId = normalizeHexField(metadata.neg_risk_market_id)
  const negRiskRequestId = normalizeHexField(metadata.neg_risk_request_id)
  const umaRequestTxHash = normalizeHexField(metadata.uma_request_tx_hash)
  const umaRequestLogIndex = normalizeIntegerField(metadata.uma_request_log_index)
  const umaOracleAddress = normalizeAddressField(metadata.uma_oracle_address)
  const mirrorUmaRequestTxHash = normalizeHexField(metadata.mirror_uma_request_tx_hash)
  const mirrorUmaRequestLogIndex = normalizeIntegerField(metadata.mirror_uma_request_log_index)
  const mirrorUmaOracleAddress = normalizeAddressField(metadata.mirror_uma_oracle_address)
  const metadataVersion = normalizeStringField(metadata.version)
  const metadataSchema = normalizeStringField(metadata.schema)

  const normalizedMarketEndTime = normalizeTimestamp(metadata.end_time)

  const conditionUpdate: Record<string, any> = {}
  if (umaRequestTxHash) {
    conditionUpdate.uma_request_tx_hash = umaRequestTxHash
  }
  if (umaRequestLogIndex != null) {
    conditionUpdate.uma_request_log_index = umaRequestLogIndex
  }
  if (umaOracleAddress) {
    conditionUpdate.uma_oracle_address = umaOracleAddress
  }
  if (mirrorUmaRequestTxHash) {
    conditionUpdate.mirror_uma_request_tx_hash = mirrorUmaRequestTxHash
  }
  if (mirrorUmaRequestLogIndex != null) {
    conditionUpdate.mirror_uma_request_log_index = mirrorUmaRequestLogIndex
  }
  if (mirrorUmaOracleAddress) {
    conditionUpdate.mirror_uma_oracle_address = mirrorUmaOracleAddress
  }
  if (Object.keys(conditionUpdate).length > 0) {
    await db
      .update(conditionsTable)
      .set(conditionUpdate)
      .where(eq(conditionsTable.id, market.id))
  }

  const marketData: typeof marketsTable.$inferInsert = {
    condition_id: market.id,
    event_id: eventId,
    is_resolved: market.resolved,
    is_active: !market.resolved,
    title: String(metadata.name),
    slug: String(metadata.slug),
    short_title: normalizeStringField(metadata.short_title),
    icon_url: iconUrl,
    metadata: JSON.stringify(metadata),
    question: question ?? null,
    market_rules: marketRules ?? null,
    resolution_source: resolutionSource ?? null,
    resolution_source_url: resolutionSourceUrl ?? null,
    resolver: resolverAddress ?? null,
    neg_risk: negRiskFlag,
    neg_risk_other: negRiskOtherFlag,
    neg_risk_market_id: negRiskMarketId ?? null,
    neg_risk_request_id: negRiskRequestId ?? null,
    metadata_version: metadataVersion ?? null,
    metadata_schema: metadataSchema ?? null,
    created_at: new Date(timestamps.createdAtIso),
    updated_at: new Date(timestamps.updatedAtIso),
  }

  if (normalizedMarketEndTime) {
    marketData.end_time = new Date(normalizedMarketEndTime)
  }

  await db
    .insert(marketsTable)
    .values(marketData)
    .onConflictDoUpdate({
      target: [marketsTable.condition_id],
      set: marketData,
    })

  if (!marketAlreadyExists && metadata.outcomes?.length > 0) {
    await processOutcomes(market.id, metadata.outcomes)
  }

  return eventIdForStatusUpdate
}

async function updateEventStatusesFromMarketsBatch(eventIds: string[]) {
  const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)))
  if (uniqueEventIds.length === 0) {
    return
  }

  const [currentEvents, marketRows] = await Promise.all([
    db
      .select({
        id: eventsTable.id,
        status: eventsTable.status,
        resolved_at: eventsTable.resolved_at,
      })
      .from(eventsTable)
      .where(inArray(eventsTable.id, uniqueEventIds)),
    db
      .select({
        event_id: marketsTable.event_id,
        is_active: marketsTable.is_active,
        is_resolved: marketsTable.is_resolved,
      })
      .from(marketsTable)
      .where(inArray(marketsTable.event_id, uniqueEventIds)),
  ])

  const currentEventById = new Map(
    (currentEvents ?? []).map(event => [event.id, event]),
  )
  const countsByEventId = new Map<string, { total: number, active: number, unresolved: number }>()

  for (const eventId of uniqueEventIds) {
    countsByEventId.set(eventId, { total: 0, active: 0, unresolved: 0 })
  }

  for (const market of marketRows) {
    const eventId = market.event_id
    if (!eventId || !countsByEventId.has(eventId)) {
      continue
    }

    const bucket = countsByEventId.get(eventId)!
    bucket.total += 1

    const isActiveMarket = market.is_active === true
      || (market.is_active == null && market.is_resolved === false)
    if (isActiveMarket) {
      bucket.active += 1
    }

    const isUnresolvedMarket = market.is_resolved === false || market.is_resolved == null
    if (isUnresolvedMarket) {
      bucket.unresolved += 1
    }
  }

  for (const eventId of uniqueEventIds) {
    const currentEvent = currentEventById.get(eventId)
    if (!currentEvent) {
      continue
    }

    const counts = countsByEventId.get(eventId) ?? { total: 0, active: 0, unresolved: 0 }
    const hasMarkets = counts.total > 0
    const hasActiveMarket = counts.active > 0
    const hasUnresolvedMarket = counts.unresolved > 0

    const nextStatus: 'draft' | 'active' | 'resolved' | 'archived'
      = !hasMarkets
        ? 'draft'
        : !hasUnresolvedMarket
            ? 'resolved'
            : hasActiveMarket
              ? 'active'
              : 'archived'

    const shouldSetResolvedAt = nextStatus === 'resolved'
      && (currentEvent.resolved_at == null)
    const resolvedAtUpdate = shouldSetResolvedAt
      ? new Date()
      : nextStatus === 'resolved'
        ? currentEvent.resolved_at ?? null
        : null

    const currentResolvedAtIso = currentEvent.resolved_at?.toISOString() ?? null
    const nextResolvedAtIso = resolvedAtUpdate?.toISOString() ?? null
    if (currentEvent.status === nextStatus && currentResolvedAtIso === nextResolvedAtIso) {
      continue
    }

    await db
      .update(eventsTable)
      .set({ status: nextStatus, resolved_at: resolvedAtUpdate })
      .where(eq(eventsTable.id, eventId))
  }
}

function requireSubgraphTimestampIso(
  rawValue: string | null | undefined,
  fieldName: 'creationTimestamp' | 'updatedAt',
  marketId: string,
) {
  if (!rawValue) {
    throw new Error(`Market ${marketId} missing required ${fieldName} field`)
  }

  const timestamp = Number(rawValue)
  if (Number.isNaN(timestamp)) {
    throw new TypeError(`Market ${marketId} has invalid ${fieldName}: ${rawValue}`)
  }

  return new Date(timestamp * 1000).toISOString()
}

function getMarketTimestamps(market: SubgraphCondition): MarketTimestamps {
  return {
    createdAtIso: requireSubgraphTimestampIso(market.creationTimestamp, 'creationTimestamp', market.id),
    updatedAtIso: requireSubgraphTimestampIso(market.updatedAt, 'updatedAt', market.id),
  }
}

async function processOutcomes(conditionId: string, outcomes: any[]) {
  const outcomeData = outcomes.map((outcome, index) => ({
    condition_id: conditionId,
    outcome_text: outcome.outcome,
    outcome_index: index,
    token_id: outcome.token_id || (`${conditionId}${index}`),
  }))

  await db.insert(outcomesTable).values(outcomeData)
}

async function processTags(eventId: string, tagNames: any[]) {
  const normalizedTagBySlug = new Map<string, string>()

  for (const tagName of tagNames) {
    if (typeof tagName !== 'string') {
      console.warn(`Skipping invalid tag:`, tagName)
      continue
    }

    const truncatedName = tagName.trim().substring(0, 100)
    if (!truncatedName) {
      continue
    }

    const slug = truncatedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 100)
    if (!slug) {
      continue
    }

    if (!normalizedTagBySlug.has(slug)) {
      normalizedTagBySlug.set(slug, truncatedName)
    }
  }

  if (normalizedTagBySlug.size === 0) {
    return
  }

  const slugs = Array.from(normalizedTagBySlug.keys())
  const tagIdBySlug = new Map<string, number>()

  let existingTags: Array<{ id: number, slug: string }> = []
  try {
    existingTags = await db
      .select({
        id: tagsTable.id,
        slug: tagsTable.slug,
      })
      .from(tagsTable)
      .where(inArray(tagsTable.slug, slugs))
  }
  catch (existingTagsError) {
    console.error(`Failed to load existing tags for event ${eventId}:`, existingTagsError)
    return
  }

  for (const tag of existingTags) {
    if (typeof tag.slug === 'string' && typeof tag.id === 'number') {
      tagIdBySlug.set(tag.slug, tag.id)
    }
  }

  const rowsToInsert = slugs
    .filter(slug => !tagIdBySlug.has(slug))
    .map(slug => ({
      name: normalizedTagBySlug.get(slug)!,
      slug,
    }))

  if (rowsToInsert.length > 0) {
    let insertedTags: Array<{ id: number, slug: string }> = []
    try {
      insertedTags = await db
        .insert(tagsTable)
        .values(rowsToInsert)
        .onConflictDoNothing({
          target: [tagsTable.slug],
        })
        .returning({
          id: tagsTable.id,
          slug: tagsTable.slug,
        })
    }
    catch (upsertTagsError) {
      console.error(`Failed to create tags for event ${eventId}:`, upsertTagsError)
      return
    }

    for (const tag of insertedTags) {
      if (typeof tag.slug === 'string' && typeof tag.id === 'number') {
        tagIdBySlug.set(tag.slug, tag.id)
      }
    }

    if (tagIdBySlug.size < slugs.length) {
      try {
        const refreshedTags = await db
          .select({
            id: tagsTable.id,
            slug: tagsTable.slug,
          })
          .from(tagsTable)
          .where(inArray(tagsTable.slug, slugs))

        for (const tag of refreshedTags) {
          if (typeof tag.slug === 'string' && typeof tag.id === 'number') {
            tagIdBySlug.set(tag.slug, tag.id)
          }
        }
      }
      catch (refreshedTagsError) {
        console.error(`Failed to refresh tags for event ${eventId}:`, refreshedTagsError)
        return
      }
    }
  }

  const eventTagRows = slugs
    .map(slug => tagIdBySlug.get(slug))
    .filter((tagId): tagId is number => Number.isInteger(tagId))
    .map(tagId => ({
      event_id: eventId,
      tag_id: tagId,
    }))

  if (eventTagRows.length === 0) {
    return
  }

  try {
    await db
      .insert(eventTagsTable)
      .values(eventTagRows)
      .onConflictDoNothing({
        target: [eventTagsTable.event_id, eventTagsTable.tag_id],
      })
  }
  catch (eventTagsError) {
    console.error(`Failed to upsert event_tags for event ${eventId}:`, eventTagsError)
  }
}

function resolveImageMeta(contentType: string | null, bytes: Uint8Array | null) {
  const normalized = (contentType ?? '').split(';')[0]?.trim().toLowerCase()

  if (normalized === 'image/png') {
    return { extension: 'png', contentType: 'image/png' }
  }
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return { extension: 'jpg', contentType: 'image/jpeg' }
  }
  if (normalized === 'image/webp') {
    return { extension: 'webp', contentType: 'image/webp' }
  }

  if (bytes) {
    if (bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4E
      && bytes[3] === 0x47
      && bytes[4] === 0x0D
      && bytes[5] === 0x0A
      && bytes[6] === 0x1A
      && bytes[7] === 0x0A) { return { extension: 'png', contentType: 'image/png' } }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return { extension: 'jpg', contentType: 'image/jpeg' }
    }
    if (bytes.length >= 12
      && bytes[0] === 0x52
      && bytes[1] === 0x49
      && bytes[2] === 0x46
      && bytes[3] === 0x46
      && bytes[8] === 0x57
      && bytes[9] === 0x45
      && bytes[10] === 0x42
      && bytes[11] === 0x50) { return { extension: 'webp', contentType: 'image/webp' } }
  }

  return { extension: 'jpg', contentType: 'image/jpeg' }
}

function resolveImageStoragePath(storagePath: string, extension: string) {
  if (/\.(?:png|jpe?g|webp)$/i.test(storagePath)) {
    return storagePath
  }
  return `${storagePath}.${extension}`
}

async function downloadAndSaveImage(metadataHash: string, storagePath: string) {
  try {
    const imageUrl = `${IRYS_GATEWAY}/${metadataHash}`
    const response = await fetch(imageUrl, {
      keepalive: true,
    })

    if (!response.ok) {
      console.error(`Failed to download image: ${response.statusText}`)
      return null
    }

    const imageBuffer = await response.arrayBuffer()
    const imageBytes = new Uint8Array(imageBuffer)
    const resolvedMeta = resolveImageMeta(response.headers.get('content-type'), imageBytes)
    const resolvedPath = resolveImageStoragePath(storagePath, resolvedMeta.extension)

    const { error } = await uploadPublicAsset(resolvedPath, imageBuffer, {
      contentType: resolvedMeta.contentType,
      cacheControl: '31536000',
      upsert: true,
    })

    if (error) {
      console.error(`Failed to upload image: ${error}`)
      return null
    }

    return resolvedPath
  }
  catch (error) {
    console.error(`Failed to process image ${metadataHash}:`, error)
    return null
  }
}

function normalizeStringField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function hashStringToHex(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeStorageSlug(value: unknown, fallbackSeed: string) {
  const rawValue = typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value)
  const sanitized = rawValue
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (sanitized) {
    return sanitized
  }

  return `icon-${hashStringToHex(fallbackSeed || rawValue || 'fallback')}`
}

function normalizeIntegerField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed)
    }
  }

  return null
}

function normalizeAddressField(value: unknown): string | null {
  const normalized = normalizeStringField(value)
  if (!normalized) {
    return null
  }
  return /^0x[a-fA-F0-9]{40}$/.test(normalized)
    ? normalized.toLowerCase()
    : normalized
}

function normalizeHexField(value: unknown): string | null {
  const normalized = normalizeStringField(value)
  if (!normalized) {
    return null
  }
  return normalized.startsWith('0x')
    ? normalized.toLowerCase()
    : normalized
}

function normalizeBooleanField(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return Boolean(value)
}

async function tryAcquireSyncLock(): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - SYNC_RUNNING_STALE_MS)
  const runningPayload = {
    service_name: 'market_sync',
    subgraph_name: 'pnl',
    status: 'running' as const,
    error_message: null,
  }

  try {
    const claimedRows = await db
      .update(subgraph_syncs)
      .set(runningPayload)
      .where(and(
        eq(subgraph_syncs.service_name, 'market_sync'),
        eq(subgraph_syncs.subgraph_name, 'pnl'),
        or(
          ne(subgraph_syncs.status, 'running'),
          lt(subgraph_syncs.updated_at, staleThreshold),
        ),
      ))
      .returning({ id: subgraph_syncs.id })

    if (claimedRows.length > 0) {
      return true
    }
  }
  catch (claimError: any) {
    if (isMissingColumnError(claimError, 'status')) {
      return tryAcquireLegacySyncLock()
    }
    throw new Error(`Failed to claim sync lock: ${claimError?.message ?? String(claimError)}`)
  }

  try {
    const insertedRows = await db
      .insert(subgraph_syncs)
      .values(runningPayload)
      .onConflictDoNothing()
      .returning({ id: subgraph_syncs.id })

    return insertedRows.length > 0
  }
  catch (insertError: any) {
    if (isMissingColumnError(insertError, 'status')) {
      return tryAcquireLegacySyncLock()
    }
    throw new Error(`Failed to initialize sync lock: ${insertError?.message ?? String(insertError)}`)
  }
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const message = error?.message ?? ''
  return message.includes(`column subgraph_syncs.${column} does not exist`)
}

async function tryAcquireLegacySyncLock(): Promise<boolean> {
  const legacyPayload = {
    service_name: 'market_sync',
    subgraph_name: 'pnl',
    error_message: null,
  }

  try {
    const updatedRows = await db
      .update(subgraph_syncs)
      .set(legacyPayload)
      .where(and(
        eq(subgraph_syncs.service_name, 'market_sync'),
        eq(subgraph_syncs.subgraph_name, 'pnl'),
      ))
      .returning({ id: subgraph_syncs.id })

    if (updatedRows.length > 0) {
      return true
    }
  }
  catch (updateError: any) {
    throw new Error(`Failed to claim legacy sync lock: ${updateError?.message ?? String(updateError)}`)
  }

  try {
    const insertedRows = await db
      .insert(subgraph_syncs)
      .values(legacyPayload)
      .onConflictDoNothing()
      .returning({ id: subgraph_syncs.id })

    return insertedRows.length > 0
  }
  catch (insertError: any) {
    throw new Error(`Failed to initialize legacy sync lock: ${insertError?.message ?? String(insertError)}`)
  }
}

async function updateSyncStatus(
  status: 'running' | 'completed' | 'error',
  errorMessage?: string | null,
  totalProcessed?: number,
) {
  const updateData: any = {
    service_name: 'market_sync',
    subgraph_name: 'pnl',
    status,
  }

  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage
  }

  if (totalProcessed !== undefined) {
    updateData.total_processed = totalProcessed
  }

  try {
    await db
      .insert(subgraph_syncs)
      .values(updateData)
      .onConflictDoUpdate({
        target: [subgraph_syncs.service_name, subgraph_syncs.subgraph_name],
        set: updateData,
      })
  }
  catch (error: any) {
    if (isMissingColumnError(error, 'status')) {
      return
    }
    console.error(`Failed to update sync status to ${status}:`, error)
  }
}
