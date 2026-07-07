'use client'

import type { AllowedCreatorCheckState } from './admin-create-event-form-types'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchAdminApi,
  isAllowedCreatorsResponse,
  readApiError,
} from './admin-create-event-form-utils'

interface UseAllowedCreatorWalletsParams {
  eoaAddress: string | null
  creatorWalletName: string
  setCreatorWalletDialogOpen: (open: boolean) => void
  setCreatorWalletName: (name: string) => void
}

export function useAllowedCreatorWallets({
  eoaAddress,
  creatorWalletName,
  setCreatorWalletDialogOpen,
  setCreatorWalletName,
}: UseAllowedCreatorWalletsParams) {
  const t = useExtracted()
  const [allowedCreatorCheckState, setAllowedCreatorCheckState] = useState<AllowedCreatorCheckState>('idle')
  const [allowedCreatorCheckError, setAllowedCreatorCheckError] = useState('')
  const [isAddingCreatorWallet, setIsAddingCreatorWallet] = useState(false)

  const runAllowedCreatorCheck = useCallback(async () => {
    setAllowedCreatorCheckState('checking')
    setAllowedCreatorCheckError('')

    if (!eoaAddress) {
      setAllowedCreatorCheckState('no_wallet')
      return false
    }

    try {
      const response = await fetchAdminApi(`/event-creations/allowed-creators?address=${encodeURIComponent(eoaAddress)}`, {
        method: 'GET',
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAllowedCreatorsResponse(payload)) {
        throw new Error(apiError || t('Allowed creators check failed ({status})', { status: String(response.status) }))
      }

      setAllowedCreatorCheckState(payload.allowed ? 'ok' : 'missing')
      return Boolean(payload.allowed)
    }
    catch (error) {
      console.error('Error validating allowed creator wallets:', error)
      setAllowedCreatorCheckState('error')
      setAllowedCreatorCheckError(t('Could not validate allowed market creator wallets.'))
      return false
    }
  }, [eoaAddress, t])

  const addCurrentWalletToAllowedCreators = useCallback(async () => {
    if (!eoaAddress) {
      toast.error(t('Select an EOA wallet first.'))
      return
    }

    const trimmedCreatorWalletName = creatorWalletName.trim()
    if (!trimmedCreatorWalletName) {
      toast.error(t('Wallet name is required.'))
      return
    }

    setIsAddingCreatorWallet(true)
    try {
      const response = await fetchAdminApi('/event-creations/allowed-creators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceType: 'wallet',
          walletAddress: eoaAddress,
          name: trimmedCreatorWalletName,
        }),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAllowedCreatorsResponse(payload)) {
        throw new Error(apiError || t('Failed to add allowed creator ({status})', { status: String(response.status) }))
      }

      toast.success(t('Wallet added to allowed market creator wallets.'))
      setCreatorWalletDialogOpen(false)
      setCreatorWalletName('')
      await runAllowedCreatorCheck()
    }
    catch (error) {
      console.error('Error adding allowed creator wallet:', error)
      toast.error(error instanceof Error ? error.message : t('Could not add wallet to allowed market creator wallets.'))
    }
    finally {
      setIsAddingCreatorWallet(false)
    }
  }, [creatorWalletName, eoaAddress, runAllowedCreatorCheck, setCreatorWalletDialogOpen, setCreatorWalletName, t])

  const resetAllowedCreatorCheck = useCallback(() => {
    setAllowedCreatorCheckState('idle')
    setAllowedCreatorCheckError('')
  }, [])

  return {
    allowedCreatorCheckState,
    allowedCreatorCheckError,
    isAddingCreatorWallet,
    runAllowedCreatorCheck,
    addCurrentWalletToAllowedCreators,
    resetAllowedCreatorCheck,
  }
}
