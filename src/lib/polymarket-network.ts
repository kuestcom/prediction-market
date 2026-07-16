import { polygon } from 'viem/chains'

export const POLYMARKET_CHAIN_ID = polygon.id

export function resolvePolymarketRpcUrl(reownProjectId: string) {
  const projectId = reownProjectId.trim()
  if (!projectId) {
    return 'https://polygon.drpc.org'
  }

  const url = new URL('https://rpc.walletconnect.org/v1')
  url.searchParams.set('chainId', `eip155:${POLYMARKET_CHAIN_ID}`)
  url.searchParams.set('projectId', projectId)
  return url.toString()
}
