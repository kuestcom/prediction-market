import type { TIME_RANGES } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { SportsGamesButton, SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { OUTCOME_INDEX } from '@/lib/constants'
import type { OddsFormat } from '@/lib/odds-format'
import type { NormalizedBookLevel } from '@/lib/order-panel-utils'
import type { SportsVertical } from '@/lib/sports-vertical'
import type { Market, Outcome } from '@/types'

export interface SportsGamesCenterProps {
  cards: SportsGamesCard[]
  sportSlug: string
  sportTitle: string
  pageMode?: 'games' | 'live' | 'liveAndSoon' | 'soon'
  categoryTitleBySlug?: Record<string, string>
  initialWeek?: number | null
  vertical?: SportsVertical
  showHeading?: boolean
}

export type DetailsTab = 'orderBook' | 'graph' | 'about'
export type SportsGamesMarketType = SportsGamesButton['marketType']
export type SportsGameGraphVariant = 'default' | 'sportsCardLegend' | 'sportsEventHero'
export type LinePickerMarketType = Extract<SportsGamesMarketType, 'spread' | 'total'>

export interface SportsLinePickerOption {
  conditionId: string
  label: string
  lineValue: number
  firstIndex: number
  buttons: SportsGamesButton[]
}

export interface SportsGraphSeriesTarget {
  key: string
  tokenId: string | null
  market: Market
  outcomeIndex: number
  name: string
  color: string
}

export interface SportsTradeFlowLabelItem {
  id: string
  label: string
  color: string
  createdAt: number
}

export interface SportsTradeSelection {
  cardId: string | null
  buttonKey: string | null
}

export interface SportsActiveTradeContext {
  card: SportsGamesCard
  button: SportsGamesButton
  market: Market
  outcome: Outcome
}

export interface SportsPositionTag {
  key: string
  conditionId: string
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  marketTypeLabel: 'Moneyline' | 'Spread' | 'Total' | 'Both Teams to Score' | 'Market'
  marketLabel: string
  outcomeLabel: string
  summaryLabel: string
  shares: number
  avgPriceCents: number | null
  totalCost: number | null
  currentValue: number
  realizedPnl: number
  market: Market
  outcome: Outcome
  button: SportsGamesButton | null
  latestActivityAtMs: number
}

export interface SportsCashOutModalPayload {
  outcomeLabel: string
  outcomeShortLabel: string
  outcomeIconUrl: string | null | undefined
  shares: number
  filledShares: number | null
  avgPriceCents: number | null
  receiveAmount: number | null
  sellBids: NormalizedBookLevel[]
}

export interface SportsGameDetailsPanelProps {
  card: SportsGamesCard
  activeDetailsTab: DetailsTab
  selectedButtonKey: string | null
  showBottomContent: boolean
  defaultGraphTimeRange?: (typeof TIME_RANGES)[number]
  allowedConditionIds?: Set<string> | null
  positionsTitle?: string
  showAboutTab?: boolean
  aboutEvent?: SportsGamesCard['event'] | null
  rulesEvent?: SportsGamesCard['event'] | null
  showRedeemInPositions?: boolean
  onOpenRedeemForCondition?: ((conditionId: string) => void) | null
  oddsFormat?: OddsFormat
  onChangeTab: (tab: DetailsTab) => void
  onSelectButton: (
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) => void
}
