'use client'

import { usePolymarketWallet } from '@/stores/usePolymarketWallet'

export class PolymarketWalletUnavailableError extends Error {
  constructor() {
    super('This wallet does not have an active Polymarket deposit wallet.')
    this.name = 'PolymarketWalletUnavailableError'
  }
}

async function resolvePolymarketFunder(ownerAddress: string) {
  const params = new URLSearchParams({ address: ownerAddress })
  const response = await fetch(`/api/arbitrage/polymarket-profile?${params}`)
  if (!response.ok) {
    throw new PolymarketWalletUnavailableError()
  }

  const data = await response.json() as {
    proxyWallet?: string | null
    signatureType?: 0 | 1 | 2 | 3
    ready?: boolean
  }
  const proxyWallet = data.proxyWallet?.trim()
  if (!data.ready || !proxyWallet || proxyWallet.toLowerCase() === ownerAddress.toLowerCase()) {
    throw new PolymarketWalletUnavailableError()
  }

  return {
    funderAddress: proxyWallet,
    signatureType: data.signatureType === 3
      ? 3 as const
      : data.signatureType === 2
        ? 2 as const
        : 1 as const,
  }
}

export async function syncPolymarketWallet({
  ownerAddress,
  connectorId,
  connectorUid,
}: {
  ownerAddress: string
  connectorId: string
  connectorUid: string
}) {
  const funder = await resolvePolymarketFunder(ownerAddress)
  const wallet = { ownerAddress, connectorId, connectorUid, ...funder }
  usePolymarketWallet.getState().setConnected(wallet)
  return wallet
}
