'use client'

import { useEffect, useRef } from 'react'
import { useConnections } from 'wagmi'
import { selectPolymarketConnection } from '@/lib/polymarket-connection'
import { syncPolymarketWallet } from '@/lib/polymarket-wallet-client'
import { usePolymarketWallet } from '@/stores/usePolymarketWallet'

export function usePolymarketWalletConnection() {
  const connections = useConnections()
  const restoringKeyRef = useRef<string | null>(null)
  const ownerAddress = usePolymarketWallet(state => state.ownerAddress)
  const connectorId = usePolymarketWallet(state => state.connectorId)
  const connectorUid = usePolymarketWallet(state => state.connectorUid)
  const status = usePolymarketWallet(state => state.status)

  useEffect(() => {
    if (status === 'connected' || status === 'connecting' || !ownerAddress) {
      return
    }
    if (!connectorId && !connectorUid) {
      usePolymarketWallet.getState().disconnect()
      return
    }

    const connection = selectPolymarketConnection(connections, {
      ownerAddress,
      connectorId,
      connectorUid,
    })
    if (!connection) {
      return
    }

    const restoreKey = `${ownerAddress.toLowerCase()}:${connection.connector.uid}`
    if (restoringKeyRef.current === restoreKey) {
      return
    }
    restoringKeyRef.current = restoreKey
    void syncPolymarketWallet({
      ownerAddress,
      connectorId: connection.connector.id,
      connectorUid: connection.connector.uid,
    }).catch((error) => {
      console.error('Failed to restore the Polymarket wallet connection.', error)
      const current = usePolymarketWallet.getState()
      const samePersistedWallet = current.ownerAddress?.toLowerCase() === ownerAddress.toLowerCase()
        && (
          current.connectorUid === connection.connector.uid
          || current.connectorId === connection.connector.id
        )
      if (samePersistedWallet) {
        current.disconnect()
      }
    }).finally(() => {
      if (restoringKeyRef.current === restoreKey) {
        restoringKeyRef.current = null
      }
    })
  }, [connections, connectorId, connectorUid, ownerAddress, status])
}
