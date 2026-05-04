import type { ProxyWalletStatus } from '@/types'
import { useEffect } from 'react'
import { useUser } from '@/stores/useUser'

interface UseProxyWalletPollingOptions {
  userId?: string | null
  proxyWalletAddress?: string | null
  proxyWalletStatus?: string | null
  hasDeployedProxyWallet: boolean
  hasProxyWalletAddress: boolean
}

export function useProxyWalletPolling({
  userId,
  proxyWalletAddress,
  proxyWalletStatus,
  hasDeployedProxyWallet,
  hasProxyWalletAddress,
}: UseProxyWalletPollingOptions) {
  useEffect(() => {
    if (!userId) {
      return
    }

    const needsSync = !hasProxyWalletAddress || !hasDeployedProxyWallet
    if (!needsSync) {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    function shouldContinuePolling() {
      const current = useUser.getState()
      return Boolean(current && (!current.proxy_wallet_address || current.proxy_wallet_status !== 'deployed'))
    }

    function scheduleRetry(delay: number) {
      if (!cancelled && shouldContinuePolling()) {
        timeoutId = setTimeout(fetchProxyDetails, delay)
      }
    }

    function fetchProxyDetails() {
      fetch('/api/user/proxy')
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
            timeoutId = setTimeout(fetchProxyDetails, 6_000)
          }
        })
        .catch(() => {
          scheduleRetry(10_000)
        })
    }

    fetchProxyDetails()

    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [hasDeployedProxyWallet, hasProxyWalletAddress, proxyWalletAddress, proxyWalletStatus, userId])
}
