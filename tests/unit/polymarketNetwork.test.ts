import { describe, expect, it } from 'vitest'
import { POLYMARKET_CHAIN_ID, resolvePolymarketRpcUrl } from '@/lib/polymarket-network'

describe('polymarket network', () => {
  it('always targets Polygon mainnet through the Reown RPC', () => {
    const url = new URL(resolvePolymarketRpcUrl('project-id'))

    expect(POLYMARKET_CHAIN_ID).toBe(137)
    expect(url.origin).toBe('https://rpc.walletconnect.org')
    expect(url.searchParams.get('chainId')).toBe('eip155:137')
    expect(url.searchParams.get('projectId')).toBe('project-id')
  })

  it('falls back to a Polygon mainnet RPC without a Reown project ID', () => {
    expect(resolvePolymarketRpcUrl('')).toContain('polygon')
  })
})
