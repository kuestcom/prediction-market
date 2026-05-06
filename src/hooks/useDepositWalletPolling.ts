import type { ProxyWalletStatus } from '@/types'
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
      return Boolean(current?.proxy_wallet_address && current.proxy_wallet_status !== 'deployed')
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
            proxy_wallet_address?: string | null
            proxy_wallet_signature?: string | null
            proxy_wallet_signed_at?: string | null
            proxy_wallet_status?: string | null
            proxy_wallet_tx_hash?: string | null
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

            const nextAddress = data.proxy_wallet_address ?? previous.proxy_wallet_address
            const nextSignature = data.proxy_wallet_signature ?? previous.proxy_wallet_signature
            const nextSignedAt = data.proxy_wallet_signed_at ?? previous.proxy_wallet_signed_at
            const nextStatus = (data.proxy_wallet_status as ProxyWalletStatus | null | undefined) ?? previous.proxy_wallet_status
            const nextTxHash = data.proxy_wallet_tx_hash ?? previous.proxy_wallet_tx_hash

            const nothingChanged = (
              nextAddress === previous.proxy_wallet_address
              && nextSignature === previous.proxy_wallet_signature
              && nextSignedAt === previous.proxy_wallet_signed_at
              && nextStatus === previous.proxy_wallet_status
              && nextTxHash === previous.proxy_wallet_tx_hash
            )

            if (nothingChanged) {
              return previous
            }

            return {
              ...previous,
              proxy_wallet_address: nextAddress,
              proxy_wallet_signature: nextSignature,
              proxy_wallet_signed_at: nextSignedAt,
              proxy_wallet_status: nextStatus,
              proxy_wallet_tx_hash: nextTxHash,
            }
          })

          if (!cancelled && data.proxy_wallet_address && data.proxy_wallet_status !== 'deployed') {
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
