export interface PublicPosition {
  id: string
  title: string
  slug: string
  eventSlug: string
  icon?: string
  avgPrice: number
  currentValue: number
  timestamp: number
  status: 'active' | 'closed'
  outcome?: string
  conditionId?: string
  mergeable?: boolean
  outcomeIndex?: number
  oppositeOutcome?: string
  asset?: string
  oppositeAsset?: string
  size?: number
  curPrice?: number
}
