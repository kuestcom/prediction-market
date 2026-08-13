export const TRADE_ALERT_RETENTION_MS = 24 * 60 * 60 * 1000
const TRADE_ALERT_MAX_TTL_MS = 15 * 60 * 1000

export interface TradeAlertPayload {
  notification_id: string
  profile_id: string
  followed_wallet: string
  condition_id: string
  message: string
  market_title: string
  market_icon?: string | null
  event_title?: string | null
  event_icon?: string | null
  icon?: string | null
  badge?: string | null
  url: string
  created_at: string
  expires_at: string
  trader?: string
  trader_avatar?: string | null
  side?: 'BUY' | 'SELL' | 'buy' | 'sell'
  shares?: number
  average_price?: number
  total_value?: number
  outcome?: string | null
}

export interface StoredTradeAlert extends TradeAlertPayload {
  partition: string
  read: boolean
  created_at_ms: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readRequiredString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function tradeAlertPartition(origin: string, profileId: string) {
  return `${origin}\u0000${profileId}`
}

function isTradeAlertFresh(payload: TradeAlertPayload, now = Date.now()) {
  const createdAt = Date.parse(payload.created_at)
  const expiresAt = Date.parse(payload.expires_at)
  return (
    Number.isFinite(createdAt) &&
    Number.isFinite(expiresAt) &&
    createdAt <= now + 60_000 &&
    expiresAt > now &&
    expiresAt - createdAt <= TRADE_ALERT_MAX_TTL_MS
  )
}

function resolveTradeAlertUrl(value: string, origin: string) {
  try {
    const url = new URL(value, origin)
    if (url.origin !== origin || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
      return origin
    }
    return url.toString()
  } catch {
    return origin
  }
}

export function parseTradeAlertPayload(value: unknown, options: { origin: string; now?: number }) {
  if (!isRecord(value)) {
    return null
  }

  const notificationId = readRequiredString(value, 'notification_id')
  const profileId = readRequiredString(value, 'profile_id')
  const followedWallet = readRequiredString(value, 'followed_wallet')
  const conditionId = readRequiredString(value, 'condition_id')
  const message = readRequiredString(value, 'message')
  const marketTitle = readRequiredString(value, 'market_title')
  const rawUrl = readRequiredString(value, 'url')
  const createdAt = readRequiredString(value, 'created_at')
  const expiresAt = readRequiredString(value, 'expires_at')

  if (
    !notificationId ||
    notificationId.length > 256 ||
    !profileId ||
    profileId.length > 128 ||
    !followedWallet ||
    !conditionId ||
    !message ||
    message.length > 500 ||
    !marketTitle ||
    marketTitle.length > 300 ||
    !rawUrl ||
    !createdAt ||
    !expiresAt
  ) {
    return null
  }

  const payload: TradeAlertPayload = {
    notification_id: notificationId,
    profile_id: profileId,
    followed_wallet: followedWallet.toLowerCase(),
    condition_id: conditionId.toLowerCase(),
    message,
    market_title: marketTitle,
    market_icon: typeof value.market_icon === 'string' ? value.market_icon : null,
    event_title: typeof value.event_title === 'string' ? value.event_title : null,
    event_icon: typeof value.event_icon === 'string' ? value.event_icon : null,
    icon: typeof value.icon === 'string' ? value.icon : null,
    badge: typeof value.badge === 'string' ? value.badge : null,
    url: resolveTradeAlertUrl(rawUrl, options.origin),
    created_at: createdAt,
    expires_at: expiresAt,
    trader: typeof value.trader === 'string' ? value.trader : undefined,
    trader_avatar: typeof value.trader_avatar === 'string' ? value.trader_avatar : null,
    side:
      value.side === 'BUY' || value.side === 'SELL' || value.side === 'buy' || value.side === 'sell'
        ? value.side
        : undefined,
    shares: typeof value.shares === 'number' && Number.isFinite(value.shares) ? value.shares : undefined,
    average_price:
      typeof value.average_price === 'number' && Number.isFinite(value.average_price) ? value.average_price : undefined,
    total_value:
      typeof value.total_value === 'number' && Number.isFinite(value.total_value) ? value.total_value : undefined,
    outcome: typeof value.outcome === 'string' ? value.outcome : null,
  }

  return isTradeAlertFresh(payload, options.now) ? payload : null
}

export function decodeVapidPublicKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}
