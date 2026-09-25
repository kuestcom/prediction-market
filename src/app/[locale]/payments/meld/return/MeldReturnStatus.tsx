'use client'

import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'

import { useBalance } from '@/hooks/useBalance'

const TERMINAL_STATUSES = new Set(['SETTLED', 'FAILED', 'DECLINED', 'CANCELLED', 'REFUNDED', 'AUTHORIZATION_EXPIRED'])

export function MeldReturnStatus({ checkoutId }: { checkoutId: string | null }) {
  const t = useExtracted()
  const { refetchBalance } = useBalance()
  const [status, setStatus] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const hasValidCheckoutId = Boolean(checkoutId && /^[0-9a-f-]{36}$/iu.test(checkoutId))

  function getStatusMessage() {
    if (status === 'SETTLED') {
      return t('Payment confirmed. Your Deposit Wallet balance is being refreshed.')
    }
    if (status === 'FAILED' || status === 'DECLINED') {
      return t('The payment was not completed. You can try another option.')
    }
    if (status === 'CANCELLED' || status === 'AUTHORIZATION_EXPIRED') {
      return t('The payment was cancelled or expired.')
    }
    if (status === 'REFUNDED') {
      return t('The payment was refunded.')
    }
    if (status === 'ERROR') {
      return t('The provider is still processing this payment. We will keep checking.')
    }
    if (status === 'TWO_FA_REQUIRED' || status === 'TWO_FA_PROVIDED') {
      return t('Additional verification is in progress. We will keep checking.')
    }
    if (status === 'SETTLING' || status === 'PARTIALLY_SETTLED') {
      return t('The payment is settling. We will keep checking.')
    }
    return t('We are checking the payment status. This can take a few minutes.')
  }

  useEffect(() => {
    if (!checkoutId || !/^[0-9a-f-]{36}$/iu.test(checkoutId)) {
      return
    }
    const validCheckoutId = checkoutId

    let isActive = true
    let attempts = 0
    let timeout: ReturnType<typeof setTimeout> | undefined

    function schedulePoll() {
      attempts += 1
      timeout = setTimeout(() => void poll(), attempts <= 12 ? 10_000 : 30_000)
    }

    function clearPendingCheckout() {
      try {
        if (window.localStorage.getItem('kuest:pending-meld-checkout') === validCheckoutId) {
          window.localStorage.removeItem('kuest:pending-meld-checkout')
        }
      } catch {
        // Storage is optional; status remains available from the current page.
      }
    }

    async function poll() {
      try {
        const response = await fetch(`/api/payments/meld/checkouts/${encodeURIComponent(validCheckoutId)}/status`, {
          cache: 'no-store',
        })
        if (!isActive) {
          return
        }
        if (response.status === 404) {
          setHasError(true)
          return
        }
        if (!response.ok) {
          throw new Error('checkout_status_unavailable')
        }

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('status' in result) ||
          typeof result.status !== 'string'
        ) {
          throw new Error('invalid_checkout_status')
        }

        if (!isActive) {
          return
        }

        setStatus(result.status)
        setHasError(false)
        if (TERMINAL_STATUSES.has(result.status)) {
          clearPendingCheckout()
        }
        if (result.status === 'SETTLED') {
          void refetchBalance()
        }
        if (!TERMINAL_STATUSES.has(result.status)) {
          schedulePoll()
        }
      } catch {
        if (isActive) {
          setHasError(true)
          schedulePoll()
        }
      }
    }

    void poll()
    return () => {
      isActive = false
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [checkoutId, refetchBalance, t])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-6 py-16">
      <section className="w-full rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Meld</h1>
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {hasError || !hasValidCheckoutId
            ? t('We could not refresh the status yet. The payment may still be processing.')
            : getStatusMessage()}
        </p>
      </section>
    </main>
  )
}
