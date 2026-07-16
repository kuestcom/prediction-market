'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PolymarketWalletStatus = 'disconnected' | 'connecting' | 'connected'

interface PolymarketWalletState {
  connectionRevision: number
  status: PolymarketWalletStatus
  ownerAddress: string | null
  funderAddress: string | null
  signatureType: 0 | 1 | 2 | 3
  connectorId: string | null
  connectorUid: string | null
  setConnecting: () => void
  setConnected: (wallet: {
    ownerAddress: string
    funderAddress: string
    signatureType: 0 | 1 | 2 | 3
    connectorId: string
    connectorUid: string
  }) => void
  disconnect: () => void
}

export const usePolymarketWallet = create<PolymarketWalletState>()(persist(
  set => ({
    connectionRevision: 0,
    status: 'disconnected',
    ownerAddress: null,
    funderAddress: null,
    signatureType: 0,
    connectorId: null,
    connectorUid: null,
    setConnecting: () => set(state => ({
      status: 'connecting',
      connectionRevision: state.connectionRevision + 1,
    })),
    setConnected: wallet => set(state => ({
      status: 'connected',
      connectionRevision: state.connectionRevision + 1,
      ...wallet,
    })),
    disconnect: () => set(state => ({
      status: 'disconnected',
      connectionRevision: state.connectionRevision + 1,
      ownerAddress: null,
      funderAddress: null,
      signatureType: 0,
      connectorId: null,
      connectorUid: null,
    })),
  }),
  {
    name: 'kuest:polymarket-wallet',
    partialize: state => ({
      ownerAddress: state.ownerAddress,
      funderAddress: state.funderAddress,
      signatureType: state.signatureType,
      connectorId: state.connectorId,
      connectorUid: state.connectorUid,
    }),
  },
))
