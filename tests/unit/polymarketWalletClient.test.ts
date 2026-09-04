import { afterEach, describe, expect, it, spyOn, jest } from 'bun:test'

import { syncPolymarketWallet } from '@/lib/polymarket-wallet-client'
import { usePolymarketWallet } from '@/stores/usePolymarketWallet'

afterEach(() => {
  jest.restoreAllMocks()
  usePolymarketWallet.getState().disconnect()
})

describe('polymarket wallet synchronization', () => {
  it('does not reconnect a stale wallet after a newer connection starts', async () => {
    let resolveProfile!: (response: Response) => void
    spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve
      }),
    )

    const pending = syncPolymarketWallet({
      ownerAddress: '0x0000000000000000000000000000000000000001',
      connectorId: 'io.metamask',
      connectorUid: 'old-session',
    })

    usePolymarketWallet.getState().setConnecting()
    resolveProfile(
      new Response(
        JSON.stringify({
          proxyWallet: '0x0000000000000000000000000000000000000002',
          ready: true,
          signatureType: 2,
        }),
        { status: 200 },
      ),
    )

    await expect(pending).resolves.toBeNull()
    expect(usePolymarketWallet.getState()).toMatchObject({
      status: 'connecting',
      ownerAddress: null,
      funderAddress: null,
    })
  })

  it('does not disconnect or reconnect after a stale profile failure', async () => {
    let rejectProfile!: (error: Error) => void
    spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectProfile = reject
      }),
    )

    const pending = syncPolymarketWallet({
      ownerAddress: '0x0000000000000000000000000000000000000001',
      connectorId: 'io.metamask',
      connectorUid: 'old-session',
    })

    usePolymarketWallet.getState().setConnecting()
    rejectProfile(new Error('Network unavailable'))

    await expect(pending).resolves.toBeNull()
    expect(usePolymarketWallet.getState().status).toBe('connecting')
  })
})
