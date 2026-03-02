const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on'])

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  return TRUTHY_ENV_VALUES.has(value.trim().toLowerCase())
}

export function isOwnersDocsEnabled(): boolean {
  if (process.env.DOCS_OWNERS_ENABLED !== undefined) {
    return parseBooleanEnv(process.env.DOCS_OWNERS_ENABLED)
  }

  return parseBooleanEnv(process.env.FORK_OWNER_GUIDE)
    || parseBooleanEnv(process.env.NEXT_PUBLIC_FORK_OWNER_GUIDE)
}

const LEGACY_DOCS_PATHS: Record<string, string> = {
  'platform/introduction': 'api-reference/introduction',
  'platform/api-rate-limits': 'api-reference/rate-limits',
  'platform/auth/authentication-overview': 'api-reference/authentication',
  'platform/auth/get-server-time': 'api-reference/data/get-server-time',
  'clob/orders/create-order': 'api-reference/trade/post-a-new-order',
  'clob/orders/create-orders-batch': 'api-reference/trade/post-multiple-orders',
  'clob/orders/get-order': 'api-reference/trade/get-single-order-by-id',
  'clob/orders/get-active-orders': 'api-reference/trade/get-user-orders',
  'clob/orders/get-order-scoring': 'api-reference/trade/get-order-scoring-status',
  'clob/orders/cancel-order': 'api-reference/trade/cancel-single-order',
  'clob/orders/cancel-all': 'api-reference/trade/cancel-all-orders',
  'clob/orders/cancel-market-orders': 'api-reference/trade/cancel-orders-for-a-market',
  'clob/builder/get-builder-trades': 'api-reference/trade/get-builder-trades',
  'clob/trades/get-trades': 'api-reference/trade/get-trades',
  'clob/heartbeats/post-heartbeat': 'api-reference/trade/send-heartbeat',
  'clob/orderbook/get-order-book-summary': 'api-reference/market-data/get-order-book',
  'clob/orderbook/get-multiple-order-books-summaries-by-request': 'api-reference/market-data/get-order-books-request-body',
  'clob/pricing/get-market-price': 'api-reference/market-data/get-market-price',
  'clob/pricing/get-multiple-market-prices-by-request': 'api-reference/market-data/get-market-prices-request-body',
  'clob/pricing/get-last-trade-price': 'api-reference/market-data/get-last-trade-price',
  'clob/pricing/get-last-trades-prices': 'api-reference/market-data/get-last-trade-prices-query-parameters',
  'clob/pricing/get-midpoint-price': 'api-reference/data/get-midpoint-price',
  'clob/pricing/get-midpoints': 'api-reference/market-data/get-midpoint-prices-query-parameters',
  'clob/spreads/get-bid-ask-spread': 'api-reference/market-data/get-spread',
  'clob/spreads/get-bid-ask-spreads': 'api-reference/market-data/get-spreads',
  'clob/pricing/get-price-history-for-a-traded-token': 'api-reference/markets/get-prices-history',
  'clob/market-config/get-fee-rate': 'api-reference/market-data/get-fee-rate',
  'clob/market-config/get-tick-size': 'api-reference/market-data/get-tick-size',
  'clob/market-config/get-neg-risk': 'advanced/neg-risk',
  'clob/markets/get-markets': 'api-reference/markets/list-markets',
  'clob/markets/get-market': 'api-reference/markets/get-market-by-id',
  'clob/markets/get-sampling-markets': 'api-reference/markets/get-sampling-markets',
  'clob/markets/get-simplified-markets': 'api-reference/markets/get-simplified-markets',
  'clob/markets/get-sampling-simplified-markets': 'api-reference/markets/get-sampling-simplified-markets',
  'data-api/positions/get-closed-positions': 'api-reference/core/get-closed-positions-for-a-user',
  'data-api/positions/get-current-positions': 'api-reference/core/get-current-positions-for-a-user',
  'data-api/positions/get-total-value': 'api-reference/core/get-total-value-of-a-users-positions',
  'data-api/activity/get-trades': 'api-reference/core/get-trades-for-a-user-or-markets',
  'data-api/activity/get-user-activity': 'api-reference/core/get-user-activity',
  'data-api/leaderboards/get-trader-leaderboard': 'api-reference/core/get-trader-leaderboard-rankings',
  'data-api/markets/get-top-holders': 'api-reference/core/get-top-holders-for-markets',
  'data-api/markets/get-open-interest': 'api-reference/misc/get-open-interest',
  'data-api/markets/get-live-volume': 'api-reference/misc/get-live-volume-for-an-event',
  'data-api/positions/get-total-markets-traded': 'api-reference/misc/get-total-markets-a-user-has-traded',
  'data-api/builders/get-aggregated-builder-leaderboard': 'api-reference/builders/get-aggregated-builder-leaderboard',
  'data-api/builders/get-daily-builder-volume-time-series': 'api-reference/builders/get-daily-builder-volume-time-series',
  'community/comments/get-comments': 'api-reference/comments/list-comments',
  'community/comments/get-comment-replies': 'api-reference/comments/get-comments-by-comment-id',
  'community/profile/get-profile': 'api-reference/profiles/get-public-profile-by-wallet-address',
  'websocket/overview': 'market-data/websocket/overview',
  'websocket/market-channel': 'market-data/websocket/market-channel',
  'websocket/user-channel': 'market-data/websocket/user-channel',
  'websocket/live-data': 'market-data/websocket/rtds',
  'subgraph/overview': 'market-data/subgraph',
  'conditional/overview': 'trading/ctf/overview',
  'conditional/split': 'trading/ctf/split',
  'conditional/merge': 'trading/ctf/merge',
  'conditional/redeem': 'trading/ctf/redeem',
}

function slugToPath(slug: string[] | undefined): string | null {
  if (!slug || slug.length === 0) {
    return null
  }

  return slug.join('/')
}

export function resolveDocsSlug(slug: string[] | undefined): string[] | undefined {
  const path = slugToPath(slug)
  if (!path) {
    return slug
  }

  const canonicalPath = LEGACY_DOCS_PATHS[path]
  if (!canonicalPath) {
    return slug
  }

  return canonicalPath.split('/')
}

export function getCanonicalDocsPath(slug: string[] | undefined): string | null {
  const path = slugToPath(slug)
  if (!path) {
    return null
  }

  return LEGACY_DOCS_PATHS[path] ?? null
}
