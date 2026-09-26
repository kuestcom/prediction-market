'use client'

import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBalance } from '@/hooks/useBalance'
import { useRouter } from '@/i18n/navigation'

const TERMINAL_STATUSES = new Set(['SETTLED', 'FAILED', 'DECLINED', 'CANCELLED', 'REFUNDED', 'AUTHORIZATION_EXPIRED'])

export function MeldReturnStatus({ checkoutId }: { checkoutId: string | null }) {
  const t = useExtracted()
  const router = useRouter()
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
        if (response.status === 401) {
          setHasError(true)
          return
        }
        if (response.status === 404) {
          clearPendingCheckout()
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
    <Dialog open onOpenChange={(open) => !open && router.replace('/')}>
      <DialogContent className="max-w-md" closeLabel={t('Close')}>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>Meld</DialogTitle>
          <DialogDescription aria-live="polite">
            {hasError || !hasValidCheckoutId
              ? t('We could not refresh the status yet. The payment may still be processing.')
              : getStatusMessage()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => router.replace('/')} variant="outline">
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
