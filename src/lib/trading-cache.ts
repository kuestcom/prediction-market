import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY } from '@/hooks/useBalance'

const USER_POSITION_QUERY_KEYS: QueryKey[] = [
  ['order-panel-user-positions'],
  ['user-market-positions'],
  ['event-user-positions'],
  ['user-event-positions'],
]

const SPORTS_POSITION_QUERY_KEYS: QueryKey[] = [
  ['sports-card-user-positions'],
  ['sports-event-user-positions'],
]

export const ORDER_BOOK_REFRESH_DELAY_MS = 1_000

function invalidateQueryKeys(queryClient: QueryClient, queryKeys: QueryKey[]) {
  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

export function invalidateTradingClaimQueries(
  queryClient: QueryClient,
  options: { includeSportsPositions?: boolean } = {},
) {
  invalidateQueryKeys(queryClient, [
    ...USER_POSITION_QUERY_KEYS,
    ...(options.includeSportsPositions ? SPORTS_POSITION_QUERY_KEYS : []),
    ['user-conditional-shares'],
    ['portfolio-value'],
    [DEPOSIT_WALLET_BALANCE_QUERY_KEY],
  ])
}

export function invalidatePortfolioClaimQueries(queryClient: QueryClient) {
  invalidateQueryKeys(queryClient, [
    ['user-positions'],
    ['user-market-positions'],
    ['user-conditional-shares'],
    [DEPOSIT_WALLET_BALANCE_QUERY_KEY],
    ['portfolio-value'],
  ])
}

export function scheduleOrderBookRefresh(queryClient: QueryClient) {
  return globalThis.setTimeout(() => {
    void queryClient.invalidateQueries({
      queryKey: ['orderbook-summary'],
    })
  }, ORDER_BOOK_REFRESH_DELAY_MS)
}
