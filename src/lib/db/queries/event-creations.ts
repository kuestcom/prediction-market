import type { EventCreationAssetPayload, EventCreationMode, EventCreationRecurrenceUnit, EventCreationStatus } from '@/lib/event-creation'
import type { QueryResult } from '@/types'
import { and, asc, desc, eq, ilike, inArray, lte, or } from 'drizzle-orm'
import { event_creations, event_tags, events, jobs, tags } from '@/lib/db/schema'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import { getPublicAssetUrl } from '@/lib/storage'

export interface EventCreationDraftSummary {
  id: string
  title: string
  slug: string | null
  titleTemplate: string | null
  slugTemplate: string | null
  creationMode: EventCreationMode
  status: EventCreationStatus
  startAt: string | null
  deployAt: string | null
  recurrenceUnit: EventCreationRecurrenceUnit | null
  recurrenceInterval: number | null
  recurrenceUntil: string | null
  walletAddress: string | null
  imageUrl: string | null
  updatedAt: string
}

export interface EventCreationDraftRecord extends EventCreationDraftSummary {
  endDate: string | null
  mainCategorySlug: string | null
  categorySlugs: string[]
  marketMode: string | null
  binaryQuestion: string | null
  binaryOutcomeYes: string | null
  binaryOutcomeNo: string | null
  resolutionSource: string | null
  resolutionRules: string | null
  draftPayload: Record<string, unknown> | null
  assetPayload: EventCreationAssetPayload | null
  pendingRequestId: string | null
  pendingPayloadHash: string | null
  pendingChainId: number | null
  pendingConfirmedTxs: Array<Record<string, unknown>>
}

function resolveDraftImageUrl(
  row: typeof event_creations.$inferSelect,
  sourceEventIconUrl?: string | null,
) {
  const assetPayload = row.asset_payload as EventCreationAssetPayload | null
  const eventImagePublicUrl = assetPayload?.eventImage?.publicUrl?.trim() || ''
  if (eventImagePublicUrl) {
    return eventImagePublicUrl
  }

  const eventImageStoragePath = assetPayload?.eventImage?.storagePath?.trim() || ''
  const fallbackAssetPath = eventImageStoragePath || sourceEventIconUrl?.trim() || null
  return getPublicAssetUrl(fallbackAssetPath) || null
}

function buildCopySourceAssetPayload(iconUrl: string | null | undefined): EventCreationAssetPayload | null {
  const normalizedIconUrl = iconUrl?.trim() || ''
  const publicUrl = getPublicAssetUrl(normalizedIconUrl)
  if (!normalizedIconUrl || !publicUrl) {
    return null
  }

  return {
    eventImage: {
      storagePath: normalizedIconUrl,
      publicUrl,
      fileName: normalizedIconUrl.split('/').pop() || 'event-image',
      contentType: '',
    },
    optionImages: {},
    teamLogos: {},
  }
}

function mapDraftSummary(
  row: typeof event_creations.$inferSelect,
  sourceEventIconUrl?: string | null,
): EventCreationDraftSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug ?? null,
    titleTemplate: row.title_template ?? null,
    slugTemplate: row.slug_template ?? null,
    creationMode: row.creation_mode as EventCreationMode,
    status: row.status as EventCreationStatus,
    startAt: row.start_at ? row.start_at.toISOString() : null,
    deployAt: row.deploy_at ? row.deploy_at.toISOString() : null,
    recurrenceUnit: row.recurrence_unit as EventCreationRecurrenceUnit | null,
    recurrenceInterval: row.recurrence_interval ?? null,
    recurrenceUntil: row.recurrence_until ? row.recurrence_until.toISOString() : null,
    walletAddress: row.wallet_address ?? null,
    imageUrl: resolveDraftImageUrl(row, sourceEventIconUrl),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapDraftRecord(row: typeof event_creations.$inferSelect): EventCreationDraftRecord {
  return {
    ...mapDraftSummary(row),
    endDate: row.end_date ? row.end_date.toISOString() : null,
    mainCategorySlug: row.main_category_slug ?? null,
    categorySlugs: row.category_slugs ?? [],
    marketMode: row.market_mode ?? null,
    binaryQuestion: row.binary_question ?? null,
    binaryOutcomeYes: row.binary_outcome_yes ?? null,
    binaryOutcomeNo: row.binary_outcome_no ?? null,
    resolutionSource: row.resolution_source ?? null,
    resolutionRules: row.resolution_rules ?? null,
    draftPayload: (row.draft_payload as Record<string, unknown> | null) ?? null,
    assetPayload: (row.asset_payload as EventCreationAssetPayload | null) ?? null,
    pendingRequestId: row.pending_request_id ?? null,
    pendingPayloadHash: row.pending_payload_hash ?? null,
    pendingChainId: row.pending_chain_id ?? null,
    pendingConfirmedTxs: Array.isArray(row.pending_confirmed_txs)
      ? row.pending_confirmed_txs as Array<Record<string, unknown>>
      : [],
  }
}

interface SetExecutionStateInput {
  draftId: string
  status: EventCreationStatus
  lastError?: string | null
  deployedEventId?: string | null
  nextStartAt?: Date | null
  nextDeployAt?: Date | null
  lastRunAt?: Date | null
  pendingRequestId?: string | null
  pendingPayloadHash?: string | null
  pendingChainId?: number | null
  pendingConfirmedTxs?: Array<Record<string, unknown>>
}

function buildExecutionStateUpdateValues(input: SetExecutionStateInput): Partial<typeof event_creations.$inferInsert> {
  const nextValues: Partial<typeof event_creations.$inferInsert> = {
    status: input.status,
    updated_at: new Date(),
  }

  if (Object.hasOwn(input, 'lastError')) {
    nextValues.last_error = input.lastError ?? null
  }
  if (Object.hasOwn(input, 'deployedEventId')) {
    nextValues.deployed_event_id = input.deployedEventId
  }
  if (Object.hasOwn(input, 'nextStartAt')) {
    nextValues.start_at = input.nextStartAt
  }
  if (Object.hasOwn(input, 'nextDeployAt')) {
    nextValues.deploy_at = input.nextDeployAt
  }
  if (Object.hasOwn(input, 'lastRunAt')) {
    nextValues.last_run_at = input.lastRunAt
  }
  if (Object.hasOwn(input, 'pendingRequestId')) {
    nextValues.pending_request_id = input.pendingRequestId
  }
  if (Object.hasOwn(input, 'pendingPayloadHash')) {
    nextValues.pending_payload_hash = input.pendingPayloadHash
  }
  if (Object.hasOwn(input, 'pendingChainId')) {
    nextValues.pending_chain_id = input.pendingChainId
  }
  if (Object.hasOwn(input, 'pendingConfirmedTxs')) {
    nextValues.pending_confirmed_txs = input.pendingConfirmedTxs
  }

  return nextValues
}

export const EventCreationRepository = {
  async createDraft(input: {
    createdByUserId: string
    creationMode: EventCreationMode
    title?: string
    slug?: string | null
    startAt?: Date | null
    deployAt?: Date | null
    endDate?: Date | null
    sourceEventId?: string | null
    draftPayload?: Record<string, unknown> | null
    assetPayload?: EventCreationAssetPayload | null
    mainCategorySlug?: string | null
    categorySlugs?: string[]
  }): Promise<QueryResult<EventCreationDraftSummary>> {
    return runQuery(async () => {
      const insertedRows = await db
        .insert(event_creations)
        .values({
          created_by_user_id: input.createdByUserId,
          updated_by_user_id: input.createdByUserId,
          title: input.title?.trim() || '',
          slug: input.slug?.trim() || null,
          creation_mode: input.creationMode,
          status: 'draft',
          start_at: input.startAt ?? null,
          deploy_at: input.deployAt ?? null,
          end_date: input.endDate ?? null,
          source_event_id: input.sourceEventId ?? null,
          draft_payload: input.draftPayload ?? null,
          asset_payload: (input.assetPayload as Record<string, unknown> | null) ?? null,
          main_category_slug: input.mainCategorySlug?.trim().toLowerCase() || null,
          category_slugs: input.categorySlugs ?? [],
        })
        .returning()

      const row = insertedRows[0]
      if (!row) {
        return { data: null, error: 'Could not create draft.' }
      }

      return {
        data: mapDraftSummary(row),
        error: null,
      }
    })
  },

  async listDraftSummariesByUser(input: {
    userId: string
    search?: string
    statuses?: EventCreationStatus[]
  }): Promise<QueryResult<EventCreationDraftSummary[]>> {
    return runQuery(async () => {
      const trimmedSearch = input.search?.trim()
      const searchCondition = trimmedSearch
        ? or(
            ilike(event_creations.title, `%${trimmedSearch}%`),
            ilike(event_creations.slug, `%${trimmedSearch}%`),
          )
        : undefined

      const statusCondition = input.statuses && input.statuses.length > 0
        ? inArray(event_creations.status, input.statuses)
        : undefined

      const rows = await db
        .select({
          draft: event_creations,
          sourceEventIconUrl: events.icon_url,
        })
        .from(event_creations)
        .leftJoin(events, eq(event_creations.source_event_id, events.id))
        .where(and(
          eq(event_creations.created_by_user_id, input.userId),
          searchCondition,
          statusCondition,
        ))
        .orderBy(desc(event_creations.updated_at), asc(event_creations.title))
        .limit(50)

      return {
        data: rows.map(({ draft, sourceEventIconUrl }) => mapDraftSummary(draft, sourceEventIconUrl)),
        error: null,
      }
    })
  },

  async getDraftByIdForUser(input: {
    draftId: string
    userId: string
  }): Promise<QueryResult<EventCreationDraftRecord>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(event_creations)
        .where(and(
          eq(event_creations.id, input.draftId),
          eq(event_creations.created_by_user_id, input.userId),
        ))
        .limit(1)

      const row = rows[0]
      if (!row) {
        return { data: null, error: 'Draft not found.' }
      }

      return {
        data: mapDraftRecord(row),
        error: null,
      }
    })
  },

  async getDraftById(input: {
    draftId: string
  }): Promise<QueryResult<EventCreationDraftRecord>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(event_creations)
        .where(eq(event_creations.id, input.draftId))
        .limit(1)

      const row = rows[0]
      if (!row) {
        return { data: null, error: 'Draft not found.' }
      }

      return {
        data: mapDraftRecord(row),
        error: null,
      }
    })
  },

  async getCopySourceEvent(input: {
    eventId: string
  }): Promise<QueryResult<{
    id: string
    title: string
    slug: string
    endDate: Date | null
    rules: string | null
    assetPayload: EventCreationAssetPayload | null
    mainCategorySlug: string | null
    categories: Array<{ label: string, slug: string }>
  }>> {
    return runQuery(async () => {
      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          slug: events.slug,
          endDate: events.end_date,
          iconUrl: events.icon_url,
          rules: events.rules,
        })
        .from(events)
        .where(eq(events.id, input.eventId))
        .limit(1)

      const row = rows[0]
      if (!row) {
        return { data: null, error: 'Event not found.' }
      }

      const tagRows = await db
        .select({
          slug: tags.slug,
          name: tags.name,
          isMainCategory: tags.is_main_category,
        })
        .from(event_tags)
        .innerJoin(tags, eq(event_tags.tag_id, tags.id))
        .where(eq(event_tags.event_id, input.eventId))

      const mainCategory = tagRows.find(item => item.isMainCategory) ?? tagRows[0] ?? null
      const categories = tagRows
        .filter(item => item.slug !== mainCategory?.slug)
        .map(item => ({
          label: item.name,
          slug: item.slug,
        }))

      return {
        data: {
          id: row.id,
          title: row.title,
          slug: row.slug,
          endDate: row.endDate ?? null,
          rules: row.rules ?? null,
          assetPayload: buildCopySourceAssetPayload(row.iconUrl),
          mainCategorySlug: mainCategory?.slug ?? null,
          categories,
        },
        error: null,
      }
    })
  },

  async updateDraftCoreFields(input: {
    draftId: string
    userId: string
    title?: string
    slug?: string | null
    endDate?: Date | null
    updatedByUserId?: string | null
    titleTemplate?: string | null
    slugTemplate?: string | null
    startAt?: Date | null
    deployAt?: Date | null
    walletAddress?: string | null
    status?: EventCreationStatus
    recurrenceUnit?: EventCreationRecurrenceUnit | null
    recurrenceInterval?: number | null
    recurrenceUntil?: Date | null
    draftPayload?: Record<string, unknown> | null
    assetPayload?: EventCreationAssetPayload | null
    mainCategorySlug?: string | null
    categorySlugs?: string[]
    marketMode?: string | null
    binaryQuestion?: string | null
    binaryOutcomeYes?: string | null
    binaryOutcomeNo?: string | null
    resolutionSource?: string | null
    resolutionRules?: string | null
  }): Promise<QueryResult<EventCreationDraftSummary>> {
    return runQuery(async () => {
      const nextValues: Partial<typeof event_creations.$inferInsert> = {
        updated_by_user_id: input.updatedByUserId ?? input.userId,
        updated_at: new Date(),
      }

      if (typeof input.title !== 'undefined') {
        nextValues.title = input.title.trim()
      }
      if (typeof input.slug !== 'undefined') {
        nextValues.slug = input.slug?.trim() || null
      }
      if (typeof input.titleTemplate !== 'undefined') {
        nextValues.title_template = input.titleTemplate?.trim() || null
      }
      if (typeof input.slugTemplate !== 'undefined') {
        nextValues.slug_template = input.slugTemplate?.trim() || null
      }
      if (typeof input.startAt !== 'undefined') {
        nextValues.start_at = input.startAt
      }
      if (typeof input.deployAt !== 'undefined') {
        nextValues.deploy_at = input.deployAt
      }
      if (typeof input.endDate !== 'undefined') {
        nextValues.end_date = input.endDate
      }
      if (typeof input.walletAddress !== 'undefined') {
        nextValues.wallet_address = input.walletAddress?.trim().toLowerCase() || null
      }
      if (typeof input.status !== 'undefined') {
        nextValues.status = input.status
      }
      if (typeof input.recurrenceUnit !== 'undefined') {
        nextValues.recurrence_unit = input.recurrenceUnit
      }
      if (typeof input.recurrenceInterval !== 'undefined') {
        nextValues.recurrence_interval = input.recurrenceInterval
      }
      if (typeof input.recurrenceUntil !== 'undefined') {
        nextValues.recurrence_until = input.recurrenceUntil
      }
      if (typeof input.draftPayload !== 'undefined') {
        nextValues.draft_payload = input.draftPayload
      }
      if (typeof input.assetPayload !== 'undefined') {
        nextValues.asset_payload = input.assetPayload as Record<string, unknown> | null
      }
      if (typeof input.mainCategorySlug !== 'undefined') {
        nextValues.main_category_slug = input.mainCategorySlug?.trim().toLowerCase() || null
      }
      if (typeof input.categorySlugs !== 'undefined') {
        nextValues.category_slugs = input.categorySlugs
      }
      if (typeof input.marketMode !== 'undefined') {
        nextValues.market_mode = input.marketMode
      }
      if (typeof input.binaryQuestion !== 'undefined') {
        nextValues.binary_question = input.binaryQuestion
      }
      if (typeof input.binaryOutcomeYes !== 'undefined') {
        nextValues.binary_outcome_yes = input.binaryOutcomeYes
      }
      if (typeof input.binaryOutcomeNo !== 'undefined') {
        nextValues.binary_outcome_no = input.binaryOutcomeNo
      }
      if (typeof input.resolutionSource !== 'undefined') {
        nextValues.resolution_source = input.resolutionSource
      }
      if (typeof input.resolutionRules !== 'undefined') {
        nextValues.resolution_rules = input.resolutionRules
      }

      const updatedRows = await db
        .update(event_creations)
        .set(nextValues)
        .where(and(
          eq(event_creations.id, input.draftId),
          eq(event_creations.created_by_user_id, input.userId),
        ))
        .returning()

      const row = updatedRows[0]
      if (!row) {
        return { data: null, error: 'Draft not found.' }
      }

      return {
        data: mapDraftSummary(row),
        error: null,
      }
    })
  },

  async deleteDraft(input: {
    draftId: string
    userId: string
  }): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      const deletedRows = await db
        .delete(event_creations)
        .where(and(
          eq(event_creations.id, input.draftId),
          eq(event_creations.created_by_user_id, input.userId),
        ))
        .returning({ id: event_creations.id })

      if (!deletedRows[0]) {
        return { data: null, error: 'Draft not found.' }
      }

      return {
        data: true,
        error: null,
      }
    })
  },

  async listDueScheduledDrafts(now: Date): Promise<QueryResult<EventCreationDraftRecord[]>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(event_creations)
        .where(and(
          inArray(event_creations.status, ['scheduled']),
          lte(event_creations.deploy_at, now),
        ))
        .orderBy(asc(event_creations.deploy_at), asc(event_creations.updated_at))
        .limit(50)

      return {
        data: rows.map(mapDraftRecord),
        error: null,
      }
    })
  },

  async setExecutionState(input: SetExecutionStateInput): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      const rows = await db
        .update(event_creations)
        .set(buildExecutionStateUpdateValues(input))
        .where(eq(event_creations.id, input.draftId))
        .returning({ id: event_creations.id })

      return {
        data: rows.length > 0,
        error: null,
      }
    })
  },

  async enqueueDeployJob(input: {
    draftId: string
    dedupeKey: string
    availableAt: Date
  }): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      await db
        .insert(jobs)
        .values({
          job_type: 'deploy_event_creation',
          dedupe_key: input.dedupeKey,
          payload: {
            draftId: input.draftId,
          },
          status: 'pending',
          attempts: 0,
          max_attempts: 6,
          available_at: input.availableAt,
          reserved_at: null,
          last_error: null,
        })
        .onConflictDoNothing({
          target: [jobs.job_type, jobs.dedupe_key],
        })

      return {
        data: true,
        error: null,
      }
    })
  },
}
