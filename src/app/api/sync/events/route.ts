import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

const PNL_SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmfbr456t4gud01w483uu2d9d/subgraphs/pnl-subgraph/1.0.0/gn'
const IRYS_GATEWAY = process.env.IRYS_GATEWAY || 'https://gateway.irys.xyz'
const SYNC_TIME_LIMIT_MS = 250_000
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
 * This function syncs prediction markets from the Goldsky PnL subgraph to Supabase:
 * - Fetches new markets from blockchain via subgraph (INCREMENTAL)
 * - Downloads metadata and images from Irys
 * - Stores everything in Supabase database and storage
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const isRunning = await checkSyncRunning()
    if (isRunning) {
      console.log('🚫 Sync already running, skipping...')
      return NextResponse.json({
        success: false,
        message: 'Sync already running',
        skipped: true,
      }, { status: 409 })
    }

    await updateSyncStatus('running')

    console.log('🚀 Starting incremental market synchronization...')

    const updatedAt = await getLastUpdatedAt()
    console.log(`📊 Last processed at: ${updatedAt}`)

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

async function getLastUpdatedAt() {
  const { data, error } = await supabaseAdmin
    .from('subgraph_syncs')
    .select('updated_at')
    .eq('service_name', 'market_sync')
    .eq('subgraph_name', 'pnl')
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get last processed timestamp: ${error.message}`)
  }

  return data?.updated_at || 0
}

async function syncMarkets(allowedCreators: Set<string>): Promise<SyncStats> {
  const syncStartedAt = Date.now()
  let cursor = await getLastProcessedConditionCursor()

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
        cursor = conditionCursor
        continue
      }

      const creatorAddress = condition.creator.toLowerCase()
      if (!allowedCreators.has(creatorAddress)) {
        skippedCreatorCount++
        console.log(`🚫 Skipping market ${condition.id} - creator ${condition.creator} not in allowed list`)
        cursor = conditionCursor
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
        console.log(`✅ Processed market: ${condition.id}`)
      }
      catch (error: any) {
        console.error(`❌ Error processing market ${condition.id}:`, error)
        errors.push({
          conditionId: condition.id,
          error: error.message ?? String(error),
        })
      }

      cursor = conditionCursor
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

async function getLastProcessedConditionCursor(): Promise<SyncCursor | null> {
  const { data, error } = await supabaseAdmin
    .from('conditions')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get last processed condition: ${error.message}`)
  }

  if (!data?.id || !data?.updated_at) {
    return null
  }

  const updatedAt = Math.floor(new Date(data.updated_at).getTime() / 1000)

  return {
    conditionId: data.id,
    updatedAt,
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

  const { error } = await supabaseAdmin.from('conditions').upsert({
    id: market.id,
    oracle: market.oracle,
    question_id: market.questionId,
    resolved: market.resolved,
    metadata_hash: market.metadataHash,
    creator: market.creator!,
    created_at: timestamps.createdAtIso,
    updated_at: timestamps.updatedAtIso,
  })

  if (error) {
    throw new Error(`Failed to create/update condition: ${error.message}`)
  }

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

  const normalizedEndDate = normalizeTimestamp(eventData.end_time)
  const enableNegRiskFlag = normalizeBooleanField(eventData.enable_neg_risk)
  const negRiskAugmentedFlag = normalizeBooleanField(eventData.neg_risk_augmented)
  const eventNegRiskFlag = normalizeBooleanField(eventData.neg_risk)
  const eventNegRiskMarketId = normalizeHexField(eventData.neg_risk_market_id)

  const { data: existingEvent } = await supabaseAdmin
    .from('events')
    .select('id, end_date, created_at')
    .eq('slug', eventData.slug)
    .maybeSingle()

  if (existingEvent) {
    const updatePayload: Record<string, any> = {
      enable_neg_risk: enableNegRiskFlag,
      neg_risk_augmented: negRiskAugmentedFlag,
      neg_risk: eventNegRiskFlag,
      neg_risk_market_id: eventNegRiskMarketId ?? null,
    }

    const existingCreatedAtMs = Date.parse(existingEvent.created_at)
    const incomingCreatedAtMs = Date.parse(createdAtIso)
    if (!Number.isNaN(incomingCreatedAtMs)
      && (Number.isNaN(existingCreatedAtMs) || incomingCreatedAtMs < existingCreatedAtMs)) {
      updatePayload.created_at = createdAtIso
    }

    if (normalizedEndDate && normalizedEndDate !== existingEvent.end_date) {
      updatePayload.end_date = normalizedEndDate
    }

    const { error: updateError } = await supabaseAdmin
      .from('events')
      .update(updatePayload)
      .eq('id', existingEvent.id)

    if (updateError) {
      console.error(`Failed to update event ${existingEvent.id}:`, updateError)
    }

    console.log(`Event ${eventData.slug} already exists, using existing ID: ${existingEvent.id}`)
    return existingEvent.id
  }

  let iconUrl: string | null = null
  if (eventData.icon) {
    const eventIconSlug = normalizeStorageSlug(
      eventData.slug,
      `${eventData.title ?? 'event'}:${creatorAddress}`,
    )
    iconUrl = await downloadAndSaveImage(eventData.icon, `events/icons/${eventIconSlug}`)
  }

  console.log(`Creating new event: ${eventData.slug} by creator: ${creatorAddress}`)

  const { data: newEvent, error } = await supabaseAdmin
    .from('events')
    .insert({
      slug: eventData.slug,
      title: eventData.title,
      creator: creatorAddress,
      icon_url: iconUrl,
      show_market_icons: eventData.show_market_icons !== false,
      enable_neg_risk: enableNegRiskFlag,
      neg_risk_augmented: negRiskAugmentedFlag,
      neg_risk: eventNegRiskFlag,
      neg_risk_market_id: eventNegRiskMarketId ?? null,
      rules: eventData.rules || null,
      end_date: normalizedEndDate,
      created_at: createdAtIso,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create event: ${error.message}`)
  }

  if (!newEvent?.id) {
    throw new Error(`Event creation failed: no ID returned`)
  }

  console.log(`Created event ${eventData.slug} with ID: ${newEvent.id}`)

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

  const { data: existingMarket } = await supabaseAdmin
    .from('markets')
    .select('condition_id, event_id')
    .eq('condition_id', market.id)
    .maybeSingle()

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
  const resolverAddress = normalizeAddressField(metadata.resolver)
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
    const { error: conditionUpdateError } = await supabaseAdmin
      .from('conditions')
      .update(conditionUpdate)
      .eq('id', market.id)

    if (conditionUpdateError) {
      throw new Error(`Failed to update UMA fields for condition ${market.id}: ${conditionUpdateError.message}`)
    }
  }

  const marketData: Record<string, any> = {
    condition_id: market.id,
    event_id: eventId,
    is_resolved: market.resolved,
    is_active: !market.resolved,
    title: metadata.name,
    slug: metadata.slug,
    short_title: metadata.short_title,
    icon_url: iconUrl,
    metadata,
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
    created_at: timestamps.createdAtIso,
    updated_at: timestamps.updatedAtIso,
  }

  if (normalizedMarketEndTime) {
    marketData.end_time = normalizedMarketEndTime
  }

  const { error } = await supabaseAdmin.from('markets').upsert(marketData)

  if (error) {
    throw new Error(`Failed to create market: ${error.message}`)
  }

  if (!marketAlreadyExists && metadata.outcomes?.length > 0) {
    await processOutcomes(market.id, metadata.outcomes)
  }

  return eventIdForStatusUpdate
}

async function updateEventStatusesFromMarketsBatch(eventIds: string[]) {
  for (const eventId of eventIds) {
    await updateEventStatusFromMarkets(eventId)
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

async function updateEventStatusFromMarkets(eventId: string) {
  const { data: currentEvent, error: currentEventError } = await supabaseAdmin
    .from('events')
    .select('status,resolved_at')
    .eq('id', eventId)
    .maybeSingle()

  if (currentEventError) {
    console.error(`Failed to load current status for event ${eventId}:`, currentEventError)
    return
  }

  const { count: totalCount, error: totalError } = await supabaseAdmin
    .from('markets')
    .select('condition_id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (totalError) {
    console.error(`Failed to compute market counts for event ${eventId}:`, totalError)
    return
  }

  const { count: activeCount, error: activeError } = await supabaseAdmin
    .from('markets')
    .select('condition_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .or('is_active.eq.true,and(is_active.is.null,is_resolved.eq.false)')

  if (activeError) {
    console.error(`Failed to compute active market count for event ${eventId}:`, activeError)
    return
  }

  const { count: unresolvedCount, error: unresolvedError } = await supabaseAdmin
    .from('markets')
    .select('condition_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .or('is_resolved.eq.false,is_resolved.is.null')

  if (unresolvedError) {
    console.error(`Failed to compute unresolved market count for event ${eventId}:`, unresolvedError)
    return
  }

  const hasMarkets = (totalCount ?? 0) > 0
  const hasActiveMarket = (activeCount ?? 0) > 0
  const hasUnresolvedMarket = (unresolvedCount ?? 0) > 0

  const nextStatus: 'draft' | 'active' | 'resolved' | 'archived'
    = !hasMarkets
      ? 'draft'
      : !hasUnresolvedMarket
          ? 'resolved'
          : hasActiveMarket
            ? 'active'
            : 'archived'

  const shouldSetResolvedAt = nextStatus === 'resolved'
    && (currentEvent?.resolved_at == null)
  const resolvedAtUpdate = shouldSetResolvedAt
    ? new Date().toISOString()
    : nextStatus === 'resolved'
      ? currentEvent?.resolved_at ?? null
      : null

  const { error: updateError } = await supabaseAdmin
    .from('events')
    .update({ status: nextStatus, resolved_at: resolvedAtUpdate })
    .eq('id', eventId)

  if (updateError) {
    console.error(`Failed to update status for event ${eventId}:`, updateError)
  }
}

async function processOutcomes(conditionId: string, outcomes: any[]) {
  const outcomeData = outcomes.map((outcome, index) => ({
    condition_id: conditionId,
    outcome_text: outcome.outcome,
    outcome_index: index,
    token_id: outcome.token_id || (`${conditionId}${index}`),
  }))

  const { error } = await supabaseAdmin.from('outcomes').insert(outcomeData)

  if (error) {
    throw new Error(`Failed to create outcomes: ${error.message}`)
  }
}

async function processTags(eventId: string, tagNames: any[]) {
  for (const tagName of tagNames) {
    if (typeof tagName !== 'string') {
      console.warn(`Skipping invalid tag:`, tagName)
      continue
    }

    const truncatedName = tagName.substring(0, 100)
    const slug = truncatedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 100)

    let { data: tag } = await supabaseAdmin
      .from('tags')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!tag) {
      const { data: newTag, error } = await supabaseAdmin
        .from('tags')
        .insert({ name: truncatedName, slug })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to create tag ${truncatedName}:`, error)
        continue
      }
      tag = newTag
    }

    await supabaseAdmin.from('event_tags').upsert(
      {
        event_id: eventId,
        tag_id: tag.id,
      },
      {
        onConflict: 'event_id,tag_id',
        ignoreDuplicates: true,
      },
    )
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
      && bytes[7] === 0x0A) {
      return { extension: 'png', contentType: 'image/png' }
    }
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
      && bytes[11] === 0x50) {
      return { extension: 'webp', contentType: 'image/webp' }
    }
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

    const { error } = await supabaseAdmin.storage
      .from('kuest-assets')
      .upload(resolvedPath, imageBuffer, {
        contentType: resolvedMeta.contentType,
        cacheControl: '31536000',
        upsert: true,
      })

    if (error) {
      console.error(`Failed to upload image: ${error.message}`)
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

async function checkSyncRunning(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('subgraph_syncs')
    .select('status')
    .eq('service_name', 'market_sync')
    .eq('subgraph_name', 'pnl')
    .eq('status', 'running')
    .gt('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check sync status: ${error.message}`)
  }

  return Boolean(data)
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

  const { error } = await supabaseAdmin
    .from('subgraph_syncs')
    .upsert(updateData, {
      onConflict: 'service_name,subgraph_name',
    })

  if (error) {
    console.error(`Failed to update sync status to ${status}:`, error)
  }
}
