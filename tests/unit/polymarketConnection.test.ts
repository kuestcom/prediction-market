import { describe, expect, it, vi } from 'vitest'
import {
  runOnPolymarketChain,
  selectPolymarketConnection,
  shouldSwitchPolymarketChain,
} from '@/lib/polymarket-connection'

function connection({
  account,
  chainId,
  id = 'io.metamask',
  uid,
}: {
  account: string
  chainId: number
  id?: string
  uid: string
}) {
  return {
    accounts: [account],
    chainId,
    connector: { id, uid },
  }
}

describe('polymarket wallet connection', () => {
  const ownerAddress = '0x0000000000000000000000000000000000000001'

  it('selects the exact connector uid when the same wallet connector has two sessions', () => {
    const kuestConnection = connection({ account: ownerAddress, chainId: 80_002, uid: 'metamask-kuest' })
    const polymarketConnection = connection({ account: ownerAddress, chainId: 137, uid: 'metamask-polymarket' })

    expect(selectPolymarketConnection(
      [kuestConnection, polymarketConnection],
      {
        ownerAddress,
        connectorId: 'io.metamask',
        connectorUid: 'metamask-polymarket',
      },
    )).toBe(polymarketConnection)
  })

  it('does not guess between ambiguous sessions when the saved uid is unavailable', () => {
    const connections = [
      connection({ account: ownerAddress, chainId: 80_002, uid: 'metamask-kuest' }),
      connection({ account: ownerAddress, chainId: 137, uid: 'metamask-polymarket' }),
    ]

    expect(selectPolymarketConnection(connections, {
      ownerAddress,
      connectorId: 'io.metamask',
      connectorUid: 'stale-uid',
    })).toBeUndefined()
  })

  it('falls back to the connector id when only one matching session exists', () => {
    const polymarketConnection = connection({ account: ownerAddress, chainId: 80_002, uid: 'new-uid' })

    expect(selectPolymarketConnection(
      [polymarketConnection],
      {
        ownerAddress,
        connectorId: 'io.metamask',
        connectorUid: 'stale-uid',
      },
    )).toBe(polymarketConnection)
  })

  it('switches only when the site and Polymarket use different chains and the connection is not ready', () => {
    expect(shouldSwitchPolymarketChain({ connectionChainId: 80_002 })).toBe(true)
    expect(shouldSwitchPolymarketChain({ connectionChainId: 137 })).toBe(false)
  })

  it('restores the site chain after the Polymarket operation succeeds', async () => {
    const calls: string[] = []

    await expect(runOnPolymarketChain({
      connectionChainId: 80_002,
      switchToPolymarket: async () => {
        calls.push('switch-to-polymarket')
      },
      restoreOriginalChain: async () => {
        calls.push('restore-site')
      },
      operation: async () => {
        calls.push('operation')
        return 'prepared'
      },
    })).resolves.toBe('prepared')

    expect(calls).toEqual(['switch-to-polymarket', 'operation', 'restore-site'])
  })

  it('restores the site chain when preparing the Polymarket order fails', async () => {
    const error = new Error('Signing rejected')
    const restoreSiteChain = vi.fn().mockResolvedValue(undefined)

    await expect(runOnPolymarketChain({
      connectionChainId: 80_002,
      switchToPolymarket: vi.fn().mockResolvedValue(undefined),
      restoreOriginalChain: restoreSiteChain,
      operation: vi.fn().mockRejectedValue(error),
    })).rejects.toBe(error)

    expect(restoreSiteChain).toHaveBeenCalledOnce()
  })

  it('preserves the operation failure when restoring the site chain also fails', async () => {
    const operationError = new Error('Signing rejected')

    await expect(runOnPolymarketChain({
      connectionChainId: 80_002,
      switchToPolymarket: vi.fn().mockResolvedValue(undefined),
      restoreOriginalChain: vi.fn().mockRejectedValue(new Error('Restore rejected')),
      operation: vi.fn().mockRejectedValue(operationError),
    })).rejects.toBe(operationError)
  })

  it('leaves a separate Polymarket connection on Polygon when it was already ready', async () => {
    const switchToPolymarket = vi.fn()
    const restoreSiteChain = vi.fn().mockResolvedValue(undefined)

    await expect(runOnPolymarketChain({
      connectionChainId: 137,
      switchToPolymarket,
      restoreOriginalChain: restoreSiteChain,
      operation: async () => 'prepared',
    })).resolves.toBe('prepared')

    expect(switchToPolymarket).not.toHaveBeenCalled()
    expect(restoreSiteChain).not.toHaveBeenCalled()
  })
})
