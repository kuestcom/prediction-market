import type { DepositWalletStatus } from '@/types'
import { useEffect } from 'react'
import { useUser } from '@/stores/useUser'

interface UseDepositWalletPollingOptions {
  userId?: string | null
  depositWalletAddress?: string | null
  depositWalletStatus?: string | null
  hasDeployedDepositWallet: boolean
  hasDepositWalletAddress: boolean
}

export function useDepositWalletPolling({
  userId,
  depositWalletAddress,
  depositWalletStatus,
  hasDeployedDepositWallet,
  hasDepositWalletAddress,
}: UseDepositWalletPollingOptions) {
  useEffect(() => {
    if (!userId || !hasDepositWalletAddress || hasDeployedDepositWallet) {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    function shouldContinuePolling() {
      const current = useUser.getState()
      return Boolean(current?.deposit_wallet_address && current.deposit_wallet_status !== 'deployed')
    }

    function scheduleRetry(delay: number) {
      if (!cancelled && shouldContinuePolling()) {
        timeoutId = setTimeout(fetchDepositWalletDetails, delay)
      }
    }

    function fetchDepositWalletDetails() {
      fetch('/api/user/deposit-wallet')
        .then(async (response) => {
          if (!response.ok) {
            return null
          }
          return await response.json() as {
            deposit_wallet_address?: string | null
            deposit_wallet_signature?: string | null
            deposit_wallet_signed_at?: string | null
            deposit_wallet_status?: string | null
            deposit_wallet_tx_hash?: string | null
          }
        })
        .then((data) => {
          if (cancelled) {
            return
          }

          if (!data) {
            scheduleRetry(10_000)
            return
          }

          useUser.setState((previous) => {
            if (!previous) {
              return previous
            }

            const nextAddress = data.deposit_wallet_address ?? previous.deposit_wallet_address
            const nextSignature = data.deposit_wallet_signature ?? previous.deposit_wallet_signature
            const nextSignedAt = data.deposit_wallet_signed_at ?? previous.deposit_wallet_signed_at
            const nextStatus = (data.deposit_wallet_status as DepositWalletStatus | null | undefined) ?? previous.deposit_wallet_status
            const nextTxHash = data.deposit_wallet_tx_hash ?? previous.deposit_wallet_tx_hash

            const nothingChanged = (
              nextAddress === previous.deposit_wallet_address
              && nextSignature === previous.deposit_wallet_signature
              && nextSignedAt === previous.deposit_wallet_signed_at
              && nextStatus === previous.deposit_wallet_status
              && nextTxHash === previous.deposit_wallet_tx_hash
            )

            if (nothingChanged) {
              return previous
            }

            return {
              ...previous,
              deposit_wallet_address: nextAddress,
              deposit_wallet_signature: nextSignature,
              deposit_wallet_signed_at: nextSignedAt,
              deposit_wallet_status: nextStatus,
              deposit_wallet_tx_hash: nextTxHash,
            }
          })

          if (!cancelled && data.deposit_wallet_address && data.deposit_wallet_status !== 'deployed') {
            timeoutId = setTimeout(fetchDepositWalletDetails, 6_000)
          }
        })
        .catch(() => {
          scheduleRetry(10_000)
        })
    }

    fetchDepositWalletDetails()

    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [depositWalletAddress, depositWalletStatus, hasDeployedDepositWallet, hasDepositWalletAddress, userId])
}
