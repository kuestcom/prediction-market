import type { SportsGamesMarketType } from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import type {
  SportsGamesButton,
  SportsGamesCard,
  SportsGamesCardMarketView,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { EventFaqItem } from '@/lib/event-faq'
import type { SportsEventMarketViewKey } from '@/lib/sports-event-slugs'
import type { SportsVertical } from '@/lib/sports-vertical'

export type DetailsTab = 'orderBook' | 'graph' | 'about'
export type EventSectionKey = Extract<SportsGamesMarketType, 'moneyline' | 'spread' | 'total' | 'btts'>
export type EsportsLayoutTabKey = 'series' | `segment-${number}`

export interface SportsEventCenterProps {
  card: SportsGamesCard
  marketViewCards?: SportsGamesCardMarketView[]
  relatedCards?: SportsGamesCard[]
  marketContextEnabled?: boolean
  sportSlug: string
  sportLabel: string
  faqItems: EventFaqItem[]
  initialMarketSlug?: string | null
  initialMarketViewKey?: SportsEventMarketViewKey | null
  vertical?: SportsVertical
}

export interface SportsEventQuerySelection {
  conditionId: string | null
  outcomeIndex: number | null
}

export interface AuxiliaryMarketPanel {
  key: string
  title: string
  markets: SportsGamesCard['detailMarkets']
  buttons: SportsGamesButton[]
  volume: number
  mapNumber: number | null
}

export interface SportsSegmentNumberPickerOption {
  key: string
  label: string
  number: number
}

export const SECTION_ORDER: Array<{ key: EventSectionKey, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Totals' },
  { key: 'btts', label: 'Both Teams to Score?' },
]

export const headerIconButtonClass = `
  size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors
  hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9
`

export const SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY = 'sports:event:odds-format'

export const EMPTY_QUERY_SELECTION: SportsEventQuerySelection = {
  conditionId: null,
  outcomeIndex: null,
}

export const FULL_COMPETITOR_NAME_HERO_LABEL_SPORT_SLUGS = new Set([
  'boxing',
  'chess',
  'f1',
  'golf',
  'mma',
  'tennis',
  'ufc',
  'wtt-mens-singles',
  'zuffa',
])
