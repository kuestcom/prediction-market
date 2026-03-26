import type { TransactionReceipt } from 'viem'
import type { AdminSportsCustomMarketState, AdminSportsFormState, AdminSportsPropState } from '@/lib/admin-sports-create'
import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import { buildAdminSportsDerivedContent, createInitialAdminSportsForm, isSportsMainCategory } from '@/lib/admin-sports-create'
import {
  addRecurrenceInterval,
  appendEventCreationSlugSuffix,
  applyEventCreationTemplate,
  buildEventCreationTimestampSeed,
  buildEventCreationWalletTail,
  buildScheduledRecurringDeployAt,
  slugifyEventCreationValue,
} from '@/lib/event-creation'

type MarketMode = 'binary' | 'multi_multiple' | 'multi_unique'

interface CategoryItem {
  label: string
  slug: string
}

interface PreparePayloadOption {
  id: string
  question: string
  title: string
  shortName: string
  slug: string
}

export interface EventCreationPreparePayload {
  chainId: number
  creator: string
  title: string
  slug: string
  endDateIso: string
  mainCategorySlug: string
  categories: CategoryItem[]
  marketMode: MarketMode
  binaryQuestion?: string
  binaryOutcomeYes?: string
  binaryOutcomeNo?: string
  options?: PreparePayloadOption[]
  resolutionSource: string
  resolutionRules: string
  sports?: ReturnType<typeof buildAdminSportsDerivedContent>['payload']
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback.trim()
}

function readObject(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function readSnapshot(record: EventCreationDraftRecord) {
  return readObject(record.draftPayload)
}

function readSnapshotForm(record: EventCreationDraftRecord) {
  return readObject(readSnapshot(record).form)
}

function normalizeCategoryItems(record: EventCreationDraftRecord) {
  const snapshotForm = readSnapshotForm(record)
  const snapshotCategories = Array.isArray(snapshotForm.categories) ? snapshotForm.categories : []
  const categories = snapshotCategories
    .map((item) => {
      const candidate = readObject(item)
      const label = readString(candidate.label)
      const slug = slugifyEventCreationValue(readString(candidate.slug))
      if (!label || !slug) {
        return null
      }
      return { label, slug } satisfies CategoryItem
    })
    .filter((item): item is CategoryItem => Boolean(item))

  if (categories.length > 0) {
    return categories
  }

  return record.categorySlugs.map(slug => ({
    label: slug,
    slug,
  }))
}

function normalizeSportsForm(record: EventCreationDraftRecord): AdminSportsFormState {
  const snapshotSports = readObject(readSnapshot(record).sportsForm)
  const fallback = createInitialAdminSportsForm()
  const teamsInput = Array.isArray(snapshotSports.teams) ? snapshotSports.teams : []
  const propsInput = Array.isArray(snapshotSports.props) ? snapshotSports.props : []
  const customMarketsInput = Array.isArray(snapshotSports.customMarkets) ? snapshotSports.customMarkets : []

  const teams: AdminSportsFormState['teams'][number][] = teamsInput
    .map((item, index) => {
      const candidate = readObject(item)
      return {
        hostStatus: (index === 0 ? 'home' : 'away') as 'home' | 'away',
        name: readString(candidate.name),
        abbreviation: readString(candidate.abbreviation),
      }
    })
    .slice(0, 2)

  const props = propsInput.map((item, index) => {
    const candidate = readObject(item)
    return {
      id: readString(candidate.id, `prop-${index + 1}`),
      playerName: readString(candidate.playerName),
      statType: readString(candidate.statType) as AdminSportsPropState['statType'],
      line: readString(candidate.line),
      teamHostStatus: readString(candidate.teamHostStatus) as AdminSportsPropState['teamHostStatus'],
    } satisfies AdminSportsPropState
  })

  const customMarkets = customMarketsInput.map((item, index) => {
    const candidate = readObject(item)
    return {
      id: readString(candidate.id, `market-${index + 1}`),
      sportsMarketType: readString(candidate.sportsMarketType),
      question: readString(candidate.question),
      title: readString(candidate.title),
      shortName: readString(candidate.shortName),
      slug: readString(candidate.slug),
      outcomeOne: readString(candidate.outcomeOne),
      outcomeTwo: readString(candidate.outcomeTwo),
      line: readString(candidate.line),
      groupItemTitle: readString(candidate.groupItemTitle),
      iconAssetKey: readString(candidate.iconAssetKey) as AdminSportsCustomMarketState['iconAssetKey'],
    } satisfies AdminSportsCustomMarketState
  })

  return {
    section: readString(snapshotSports.section) as AdminSportsFormState['section'] || fallback.section,
    eventVariant: readString(snapshotSports.eventVariant) as AdminSportsFormState['eventVariant'] || fallback.eventVariant,
    sportSlug: readString(snapshotSports.sportSlug, fallback.sportSlug),
    leagueSlug: readString(snapshotSports.leagueSlug, fallback.leagueSlug),
    startTime: readString(snapshotSports.startTime, fallback.startTime),
    includeDraw: snapshotSports.includeDraw === true,
    includeBothTeamsToScore: snapshotSports.includeBothTeamsToScore !== false,
    includeSpreads: snapshotSports.includeSpreads !== false,
    includeTotals: snapshotSports.includeTotals !== false,
    teams: teams.length === 2
      ? [teams[0]!, teams[1]!] as AdminSportsFormState['teams']
      : fallback.teams,
    props: props.length > 0 ? props : fallback.props,
    customMarkets: customMarkets.length > 0 ? customMarkets : fallback.customMarkets,
  }
}

function normalizeMultiOptions(record: EventCreationDraftRecord) {
  const snapshotForm = readSnapshotForm(record)
  const snapshotOptions = Array.isArray(snapshotForm.options) ? snapshotForm.options : []

  return snapshotOptions
    .map((item, index) => {
      const candidate = readObject(item)
      const title = readString(candidate.title)
      const question = readString(candidate.question)
      const shortName = readString(candidate.shortName)
      const slug = slugifyEventCreationValue(readString(candidate.slug) || title)
      if (!title || !question || !slug) {
        return null
      }

      return {
        id: readString(candidate.id, `option-${index + 1}`),
        question,
        title,
        shortName,
        slug,
        outcomeYes: readString(candidate.outcomeYes, 'Yes'),
        outcomeNo: readString(candidate.outcomeNo, 'No'),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function buildOccurrenceDate(record: EventCreationDraftRecord) {
  const snapshotForm = readSnapshotForm(record)
  const candidate = record.creationMode === 'recurring'
    ? readString(record.startAt, readString(snapshotForm.endDateIso, record.endDate ?? ''))
    : readString(snapshotForm.endDateIso, record.startAt ?? record.endDate ?? '')
  const parsed = new Date(candidate)

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError('Draft does not have a valid event date.')
  }

  return parsed
}

function buildOccurrenceContent(record: EventCreationDraftRecord, date: Date) {
  const snapshotForm = readSnapshotForm(record)
  const baseTitle = readString(snapshotForm.title, record.title)
  const baseSlug = readString(snapshotForm.slug, record.slug ?? '')

  const title = applyEventCreationTemplate(record.titleTemplate ?? '', date, baseTitle) || baseTitle
  const slugTemplateResult = applyEventCreationTemplate(record.slugTemplate ?? '', date, baseSlug)
  const baseResolvedSlug = slugifyEventCreationValue(slugTemplateResult || baseSlug || title)
  const recurringSuffix = `${buildEventCreationTimestampSeed(date)}${buildEventCreationWalletTail(record.walletAddress)}`
  const slug = record.creationMode === 'recurring'
    ? appendEventCreationSlugSuffix(baseResolvedSlug, recurringSuffix)
    : baseResolvedSlug

  if (!title || !slug) {
    throw new Error('Draft does not have a valid title/slug.')
  }

  return { title, slug }
}

export function buildEventCreationPreparePayload(input: {
  record: EventCreationDraftRecord
  creator: string
  chainId: number
}) {
  const record = input.record
  const snapshotForm = readSnapshotForm(record)
  const occurrenceDate = buildOccurrenceDate(record)
  const occurrence = buildOccurrenceContent(record, occurrenceDate)
  const mainCategorySlug = readString(snapshotForm.mainCategorySlug, record.mainCategorySlug ?? '')
  if (!mainCategorySlug) {
    throw new Error('Draft main category is missing.')
  }

  const categories = Array.from(new Map(
    [
      { label: mainCategorySlug, slug: slugifyEventCreationValue(mainCategorySlug) },
      ...normalizeCategoryItems(record),
    ]
      .filter(item => item.label && item.slug)
      .map(item => [item.slug, item]),
  ).values())

  if (categories.length < 5) {
    throw new Error('Draft must have at least 4 sub categories.')
  }

  const isSports = isSportsMainCategory(mainCategorySlug)
  const marketMode = readString(snapshotForm.marketMode, record.marketMode ?? '') as MarketMode
  const resolutionSource = readString(snapshotForm.resolutionSource, record.resolutionSource ?? '')
  const rawResolutionRules = readString(snapshotForm.resolutionRules, record.resolutionRules ?? '')
  const resolutionRules = record.creationMode === 'recurring'
    ? applyEventCreationTemplate(rawResolutionRules, occurrenceDate, rawResolutionRules)
    : rawResolutionRules

  const payload: EventCreationPreparePayload = {
    chainId: input.chainId,
    creator: input.creator,
    title: occurrence.title,
    slug: occurrence.slug,
    endDateIso: occurrenceDate.toISOString(),
    mainCategorySlug: slugifyEventCreationValue(mainCategorySlug),
    categories,
    marketMode: isSports ? 'multi_multiple' : marketMode,
    resolutionSource,
    resolutionRules,
  }

  if (isSports) {
    const sports = normalizeSportsForm(record)
    const derived = buildAdminSportsDerivedContent({
      baseSlug: occurrence.slug,
      sports,
    })

    if (!derived.payload) {
      throw new Error('Sports draft is incomplete.')
    }

    payload.options = derived.options.map(option => ({
      id: option.id,
      question: option.question.trim(),
      title: option.title.trim(),
      shortName: option.shortName.trim(),
      slug: slugifyEventCreationValue(option.slug),
    }))
    payload.sports = derived.payload
    return {
      payload,
      occurrenceDate,
      mode: record.creationMode,
    }
  }

  if (marketMode === 'binary') {
    payload.binaryQuestion = occurrence.title
    payload.binaryOutcomeYes = readString(snapshotForm.binaryOutcomeYes, record.binaryOutcomeYes ?? 'Yes')
    payload.binaryOutcomeNo = readString(snapshotForm.binaryOutcomeNo, record.binaryOutcomeNo ?? 'No')
    return {
      payload,
      occurrenceDate,
      mode: record.creationMode,
    }
  }

  const options = normalizeMultiOptions(record)
  if (options.length < 2) {
    throw new Error('Multi-market draft requires at least 2 options.')
  }

  payload.options = options.map(option => ({
    id: option.id,
    question: option.question,
    title: option.title,
    shortName: option.shortName,
    slug: option.slug,
  }))

  return {
    payload,
    occurrenceDate,
    mode: record.creationMode,
  }
}

export function buildEventCreationJobDedupeKey(record: Pick<EventCreationDraftRecord, 'id' | 'deployAt'>) {
  return `event-creation:${record.id}:${record.deployAt ?? 'no-deploy-at'}`
}

export function computeNextRecurringSchedule(record: Pick<EventCreationDraftRecord, 'creationMode' | 'startAt' | 'recurrenceUnit' | 'recurrenceInterval' | 'recurrenceUntil'>) {
  if (
    record.creationMode !== 'recurring'
    || !record.startAt
    || !record.recurrenceUnit
    || !record.recurrenceInterval
  ) {
    return null
  }

  const current = new Date(record.startAt)
  if (Number.isNaN(current.getTime())) {
    return null
  }

  const nextStartAt = addRecurrenceInterval(current, record.recurrenceUnit, record.recurrenceInterval)
  const recurrenceUntil = record.recurrenceUntil ? new Date(record.recurrenceUntil) : null
  if (recurrenceUntil && nextStartAt.getTime() > recurrenceUntil.getTime()) {
    return null
  }

  return {
    nextStartAt,
    nextDeployAt: buildScheduledRecurringDeployAt(nextStartAt, record.recurrenceUnit, record.recurrenceInterval),
  }
}

export function assertSuccessfulTransactionReceipt(
  receipt: Pick<TransactionReceipt, 'status' | 'transactionHash'>,
  hash: `0x${string}`,
) {
  if (receipt.status === 'success') {
    return receipt
  }

  throw new Error(`Transaction reverted: ${receipt.transactionHash ?? hash}`)
}

export function truncateEventCreationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim().slice(0, 1000)
}
