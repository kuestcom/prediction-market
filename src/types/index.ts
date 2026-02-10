export interface Event {
  id: string
  slug: string
  title: string
  creator: string
  icon_url: string
  show_market_icons: boolean
  enable_neg_risk?: boolean
  neg_risk_augmented?: boolean
  neg_risk?: boolean
  neg_risk_market_id?: string
  status: 'draft' | 'active' | 'resolved' | 'archived'
  rules?: string
  active_markets_count: number
  total_markets_count: number
  volume: number
  end_date: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
  markets: Market[]
  tags: {
    id: number
    name: string
    slug: string
    isMainCategory: boolean
  }[]
  main_tag: string
  is_bookmarked: boolean
  is_trending: boolean
}

export interface ConditionChangeLogEntry {
  condition_id: string
  created_at: string
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
}

export interface Market {
  condition_id: string
  question_id: string
  event_id: string
  title: string
  slug: string
  short_title?: string
  question?: string
  market_rules?: string
  resolution_source?: string
  resolution_source_url?: string
  resolver?: string
  neg_risk?: boolean
  neg_risk_other?: boolean
  neg_risk_market_id?: string
  neg_risk_request_id?: string
  metadata_version?: string
  metadata_schema?: string
  icon_url: string
  is_active: boolean
  is_resolved: boolean
  block_number: number
  block_timestamp: string
  metadata?: any
  volume_24h: number
  volume: number
  end_time?: string | null
  created_at: string
  updated_at: string
  price: number
  probability: number
  outcomes: Outcome[]
  condition: Condition
}

export interface Outcome {
  condition_id: string
  outcome_text: string
  outcome_index: number
  token_id: string
  is_winning_outcome: boolean
  payout_value?: number
  buy_price?: number
  sell_price?: number
  created_at: string
  updated_at: string
}

interface Condition {
  id: string
  oracle: string
  question_id: string
  outcome_slot_count: number
  resolved: boolean
  payout_numerators?: number[]
  payout_denominator?: number
  metadata_hash?: string
  creator?: string
  uma_request_tx_hash?: string
  uma_request_log_index?: number
  uma_oracle_address?: string
  mirror_uma_request_tx_hash?: string
  mirror_uma_request_log_index?: number
  mirror_uma_oracle_address?: string
  resolution_status?: string | null
  resolution_flagged?: boolean | null
  resolution_paused?: boolean | null
  resolution_last_update?: string | null
  resolution_price?: number | null
  resolution_was_disputed?: boolean | null
  resolution_approved?: boolean | null
  resolution_liveness_seconds?: number | null
  resolution_deadline_at?: string | null
  volume: number
  open_interest: number
  active_positions_count: number
  created_at: string
  resolved_at?: string
  updated_at: string
}

interface TradingAuthStatus {
  enabled: boolean
  updatedAt?: string
}

interface UserSettings {
  notifications?: {
    email_resolutions?: boolean
    inapp_order_fills?: boolean
    inapp_hide_small_fills?: boolean
    inapp_resolutions?: boolean
  }
  trading?: {
    market_order_type?: ClobOrderType
  }
  tradingAuth?: {
    relayer?: TradingAuthStatus
    clob?: TradingAuthStatus
    approvals?: TradingAuthStatus
  }
  [key: string]: any
}

export type ProxyWalletStatus = 'not_started' | 'signed' | 'deploying' | 'deployed'

export interface User {
  id: string
  address: string
  email: string
  twoFactorEnabled: boolean | null | undefined
  username: string
  image: string
  settings: UserSettings
  affiliate_code?: string | null
  referred_by_user_id?: string | null
  is_admin: boolean
  proxy_wallet_address?: string | null
  proxy_wallet_signature?: string | null
  proxy_wallet_signed_at?: string | null
  proxy_wallet_status?: ProxyWalletStatus | null
  proxy_wallet_tx_hash?: string | null
}

export interface PublicProfileStats {
  positions_value: number
  profit_loss: number
  volume_traded: number
  markets_traded: number
}

export interface PublicProfile {
  address: string
  proxy_wallet_address?: string | null
  username: string
  image: string
  created_at: Date
  stats?: PublicProfileStats
}

export interface Tag {
  id: number
  name: string
  slug: string
  is_main_category: boolean
  is_hidden: boolean
  display_order: number
  parent_tag_id: number | null
  active_markets_count: number
  created_at: string
  updated_at: string
}

export interface CommentPosition {
  condition_id?: string
  outcome_index?: number
  amount?: number | string
  conditionId?: string
  outcomeIndex?: number
}

export interface Comment {
  id: string
  content: string
  user_id: string
  username: string
  user_avatar: string
  user_address: string
  user_proxy_wallet_address?: string | null
  user_created_at?: string
  likes_count: number
  replies_count: number
  created_at: string
  is_owner: boolean
  user_has_liked: boolean
  positions?: CommentPosition[]
  recent_replies?: Comment[]
}

type NotificationCategory = 'trade' | 'system' | 'general'

type NotificationLinkType
  = | 'none'
    | 'market'
    | 'event'
    | 'order'
    | 'settings'
    | 'profile'
    | 'external'
    | 'custom'

export interface Notification {
  id: string
  category: NotificationCategory
  title: string
  description: string
  created_at: string
  user_avatar?: string | null
  extra_info?: string
  time_ago?: string
  link_type?: NotificationLinkType
  link_target?: string | null
  link_url?: string | null
  link_label?: string
  metadata?: Record<string, unknown>
}

export interface AffiliateData {
  referralUrl: string
  commissionPercent: number
  stats: {
    total_referrals: number
    active_referrals: number
    volume: number
    total_affiliate_fees: number
  }
  recentReferrals: {
    user_id: string
    username: string
    address: string
    proxy_wallet_address?: string | null
    image?: string | null
    created_at: string
  }[]
}

export interface ActivityOrder {
  id: string
  type?: string
  user: {
    id: string
    username: string
    address: string
    image: string
    created_at?: string
  }
  side: 'buy' | 'sell'
  amount: string
  price: string
  outcome: {
    index: number
    text: string
  }
  market: {
    condition_id?: string
    title: string
    slug: string
    icon_url: string
    event?: {
      slug: string
      show_market_icons: boolean
    }
  }
  total_value: number
  created_at: string
  status: string
  tx_hash?: string
}

export interface TopHolder {
  user: {
    id: string
    username: string
    address: string
    proxy_wallet_address?: string | null
    image: string
    created_at?: string
  }
  net_position: string
  outcome_index: number
  outcome_text: string
}

export type OrderSide = 0 | 1 // 0 = BUY, 1 = SELL
export type OrderType = 'MARKET' | 'LIMIT'
export type ClobOrderType = 'FOK' | 'FAK' | 'GTC' | 'GTD'
export type MarketOrderType = 'FAK' | 'FOK'

export interface UserOpenOrder {
  id: string
  side: 'buy' | 'sell'
  type: ClobOrderType
  status: string
  price: number
  maker_amount: number
  taker_amount: number
  size_matched: number
  created_at: string
  expiration?: number | null
  outcome: {
    index: number
    text: string
  }
  market: {
    condition_id: string
    title: string
    slug: string
    is_active: boolean
    is_resolved: boolean
    icon_url?: string
    event_slug?: string
    event_title?: string
  }
}

export type QueryResult<T>
  = | { data: T, error: null }
    | { data: null, error: string }

export interface SearchResultItems {
  events: Event[]
  profiles: PublicProfile[]
}

export interface SearchLoadingStates {
  events: boolean
  profiles: boolean
}

type Address = `0x${string}`

export interface BlockchainOrder {
  salt: bigint
  maker: Address
  signer: Address
  taker: Address
  token_id: bigint
  maker_amount: bigint
  taker_amount: bigint
  expiration: bigint
  nonce: bigint
  fee_rate_bps: bigint
  side: number
  signature_type: number
}

export interface UserPosition {
  market: {
    condition_id: string
    title: string
    slug: string
    icon_url: string
    is_active: boolean
    is_resolved: boolean
    event?: {
      slug: string
    }
  }
  outcome_index?: number
  outcome_text?: string
  average_position: number
  total_position_value: number
  total_position_cost?: number
  total_shares?: number
  profit_loss_value?: number
  profit_loss_percent?: number
  size?: number
  avgPrice?: number
  curPrice?: number
  currentValue?: number
  totalBought?: number
  initialValue?: number
  percentPnl?: number
  percentRealizedPnl?: number
  realizedPnl?: number
  cashPnl?: number
  opposite_outcome_text?: string
  order_count: number
  last_activity_at: string
}

export interface PublicActivity {
  id: string
  title: string
  slug: string
  eventSlug: string
  icon?: string
  type: string
  outcomeText?: string
  price?: number
  shares?: number
  usdcValue: number
  timestamp: number
  txHash?: string
}
