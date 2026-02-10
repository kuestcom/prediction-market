import type { Event } from '@/types'
import { OUTCOME_INDEX } from '@/lib/constants'

const FINAL_REVIEW_V4_SECONDS = 60 * 60
const FINAL_REVIEW_NEGRISK_SECONDS = 2 * 24 * 60 * 60
const FINAL_PRICE_TOLERANCE = 1e-9

const RESOLUTION_STATUS_VALUES = ['posed', 'proposed', 'reproposed', 'challenged', 'disputed', 'resolved'] as const

type ResolutionStatusValue = typeof RESOLUTION_STATUS_VALUES[number]

type TimelineMarket = Event['markets'][number]

export type ResolutionTimelineStatus = ResolutionStatusValue | 'unknown'

export type ResolutionTimelineOutcome = 'yes' | 'no' | 'invalid'

export type ResolutionTimelineItemType
  = | 'outcomeProposed'
    | 'noDispute'
    | 'disputed'
    | 'finalReview'
    | 'finalOutcome'

export type ResolutionTimelineItemIcon = 'check' | 'gavel' | 'open'

export type ResolutionTimelineItemState = 'done' | 'active' | 'pending'

export interface ResolutionTimelineItem {
  id: string
  type: ResolutionTimelineItemType
  icon: ResolutionTimelineItemIcon
  state: ResolutionTimelineItemState
  outcome: ResolutionTimelineOutcome | null
  timestampMs: number | null
  deadlineMs: number | null
  remainingSeconds: number | null
}

export interface ResolutionTimelineModel {
  status: ResolutionTimelineStatus
  outcome: ResolutionTimelineOutcome | null
  isResolved: boolean
  isDisputed: boolean
  deadlineMs: number | null
  items: ResolutionTimelineItem[]
}

interface BuildResolutionTimelineOptions {
  nowMs?: number
}

function isResolutionStatusValue(value: string): value is ResolutionStatusValue {
  return (RESOLUTION_STATUS_VALUES as readonly string[]).includes(value)
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeResolutionStatus(status: string | null | undefined): ResolutionTimelineStatus {
  if (!status) {
    return 'unknown'
  }
  const normalized = status.trim().toLowerCase()
  return isResolutionStatusValue(normalized) ? normalized : 'unknown'
}

function parseTimestampToMs(value: unknown): number | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) {
      return timestamp
    }
  }

  return null
}

function normalizeResolutionOutcomeFromPrice(price: number | null): ResolutionTimelineOutcome | null {
  if (price == null || !Number.isFinite(price)) {
    return null
  }

  if (Math.abs(price - 1) <= FINAL_PRICE_TOLERANCE) {
    return 'yes'
  }

  if (Math.abs(price) <= FINAL_PRICE_TOLERANCE) {
    return 'no'
  }

  if (Math.abs(price - 0.5) <= FINAL_PRICE_TOLERANCE) {
    return 'invalid'
  }

  return null
}

function resolveOutcomeFromMarket(market: TimelineMarket): ResolutionTimelineOutcome | null {
  const condition = market.condition
  const priceOutcome = normalizeResolutionOutcomeFromPrice(toFiniteNumber(condition?.resolution_price))
  if (priceOutcome) {
    return priceOutcome
  }

  const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
  const noOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)

  const yesPayout = toFiniteNumber(yesOutcome?.payout_value)
  const noPayout = toFiniteNumber(noOutcome?.payout_value)
  const yesWinning = yesPayout != null ? yesPayout > 0 : Boolean(yesOutcome?.is_winning_outcome)
  const noWinning = noPayout != null ? noPayout > 0 : Boolean(noOutcome?.is_winning_outcome)

  if (yesWinning && noWinning) {
    return 'invalid'
  }
  if (yesWinning) {
    return 'yes'
  }
  if (noWinning) {
    return 'no'
  }

  return null
}

function resolveFallbackDeadlineMs(market: TimelineMarket): number | null {
  const condition = market.condition
  const lastUpdateMs = parseTimestampToMs(condition?.resolution_last_update)
  if (lastUpdateMs == null) {
    return null
  }

  const isFlagged = Boolean(condition?.resolution_flagged)
  if (isFlagged) {
    const finalReviewSeconds = market.neg_risk ? FINAL_REVIEW_NEGRISK_SECONDS : FINAL_REVIEW_V4_SECONDS
    return lastUpdateMs + finalReviewSeconds * 1000
  }

  const livenessSeconds = toFiniteNumber(condition?.resolution_liveness_seconds)
  if (livenessSeconds == null || livenessSeconds < 0) {
    return null
  }

  return lastUpdateMs + livenessSeconds * 1000
}

export function resolveResolutionDeadlineMs(market: TimelineMarket): number | null {
  const explicitDeadlineMs = parseTimestampToMs(market.condition?.resolution_deadline_at)
  if (explicitDeadlineMs != null) {
    return explicitDeadlineMs
  }

  return resolveFallbackDeadlineMs(market)
}

export function formatResolutionCountdown(remainingSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

export function buildResolutionTimeline(
  market: TimelineMarket,
  options: BuildResolutionTimelineOptions = {},
): ResolutionTimelineModel {
  const nowMs = options.nowMs ?? Date.now()
  const condition = market.condition
  const status = normalizeResolutionStatus(condition?.resolution_status)
  const outcome = resolveOutcomeFromMarket(market)
  const isResolved = Boolean(market.is_resolved || condition?.resolved || status === 'resolved')
  const isDisputed = Boolean(condition?.resolution_was_disputed || status === 'challenged' || status === 'disputed')
  const deadlineMs = resolveResolutionDeadlineMs(market)
  const isFlagged = Boolean(condition?.resolution_flagged)
  const hasOpenDeadline = deadlineMs != null && deadlineMs > nowMs
  const isFinalReviewActive = isFlagged && hasOpenDeadline
  const resolutionTimestampMs = parseTimestampToMs(condition?.resolution_last_update)

  const shouldShowOutcomeProposed = isResolved
    || status === 'proposed'
    || status === 'reproposed'
    || status === 'challenged'
    || status === 'disputed'
    || status === 'resolved'
  const shouldShowNoDispute = !isDisputed && (isResolved || isFinalReviewActive)
  const shouldShowDisputed = isDisputed
  const shouldShowFinalOutcome = isResolved && !isFinalReviewActive

  const items: ResolutionTimelineItem[] = []

  if (shouldShowOutcomeProposed) {
    items.push({
      id: 'outcome-proposed',
      type: 'outcomeProposed',
      icon: 'check',
      state: 'done',
      outcome,
      timestampMs: resolutionTimestampMs,
      deadlineMs,
      remainingSeconds: null,
    })
  }

  if (shouldShowNoDispute) {
    items.push({
      id: 'no-dispute',
      type: 'noDispute',
      icon: 'check',
      state: 'done',
      outcome: null,
      timestampMs: resolutionTimestampMs,
      deadlineMs,
      remainingSeconds: null,
    })
  }

  if (shouldShowDisputed) {
    items.push({
      id: 'disputed',
      type: 'disputed',
      icon: 'gavel',
      state: isResolved ? 'done' : 'active',
      outcome: null,
      timestampMs: resolutionTimestampMs,
      deadlineMs,
      remainingSeconds: null,
    })
  }

  if (isFinalReviewActive && deadlineMs != null) {
    const remainingSeconds = Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000))
    items.push({
      id: 'final-review',
      type: 'finalReview',
      icon: 'open',
      state: 'active',
      outcome: null,
      timestampMs: resolutionTimestampMs,
      deadlineMs,
      remainingSeconds,
    })
  }

  if (shouldShowFinalOutcome) {
    items.push({
      id: 'final-outcome',
      type: 'finalOutcome',
      icon: 'check',
      state: 'done',
      outcome,
      timestampMs: resolutionTimestampMs,
      deadlineMs,
      remainingSeconds: null,
    })
  }

  return {
    status,
    outcome,
    isResolved,
    isDisputed,
    deadlineMs,
    items,
  }
}

export function shouldDisplayResolutionTimeline(market: TimelineMarket | null | undefined): boolean {
  if (!market) {
    return false
  }

  return buildResolutionTimeline(market).items.length > 0
}
