'use client'

import { useEffect, useRef } from 'react'
import { useConnections } from 'wagmi'
import { selectPolymarketConnection } from '@/lib/polymarket-connection'
import { syncPolymarketWallet } from '@/lib/polymarket-wallet-client'
import { usePolymarketWallet } from '@/stores/usePolymarketWallet'

export function usePolymarketWalletConnection() {
  const connections = useConnections()
  const restoringRef = useRef(false)
  const ownerAddress = usePolymarketWallet(state => state.ownerAddress)
  const connectorId = usePolymarketWallet(state => state.connectorId)
  const connectorUid = usePolymarketWallet(state => state.connectorUid)
  const status = usePolymarketWallet(state => state.status)

  useEffect(() => {
    if (status === 'connected' || status === 'connecting' || restoringRef.current || !ownerAddress) {
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

    restoringRef.current = true
    void syncPolymarketWallet({
      ownerAddress,
      connectorId: connection.connector.id,
      connectorUid: connection.connector.uid,
    }).catch((error) => {
      console.error('Failed to restore the Polymarket wallet connection.', error)
      usePolymarketWallet.getState().disconnect()
    }).finally(() => {
      restoringRef.current = false
    })
  }, [connections, connectorId, connectorUid, ownerAddress, status])
}
