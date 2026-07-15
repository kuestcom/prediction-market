import type { ReactNode } from 'react'
import type { EventOrderPanelOutcomeSelectedAccent } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'
import type { OUTCOME_INDEX } from '@/lib/constants'
import type { OddsFormat } from '@/lib/odds-format'
import type { Event, Market, Outcome } from '@/types'

export interface EventOrderPanelFormProps {
  isMobile: boolean
  event: Event
  initialMarket?: Market | null
  initialOutcome?: Outcome | null
  className?: string
  desktopMarketInfo?: ReactNode
  stickyDesktopTabs?: boolean
  mobileMarketInfo?: ReactNode
  primaryOutcomeIndex?: number | null
  oddsFormat?: OddsFormat
  outcomeButtonStyleVariant?: 'default' | 'sports3d'
  outcomeLabelOverrides?: Partial<Record<number, string>>
  outcomeAccentOverrides?: Partial<Record<number, EventOrderPanelOutcomeSelectedAccent>>
  optimisticallyClaimedConditionIds?: Record<string, true>
}

export type ConditionSharesMap = Record<string, Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, number>>

export type ResolveDisplayOutcomeLabel = (
  outcomeIndex: number | null | undefined,
  outcomeText: string | null | undefined,
  fallbackLabel: string,
) => string
