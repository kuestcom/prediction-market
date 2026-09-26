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
import { useRouter } from '@/i18n/navigation'
import {
  isMeldCheckoutId,
  isMeldCheckoutReturnMessage,
  MELD_CHECKOUT_RETURN_CHANNEL,
} from '@/lib/payments/meld-return-channel'

export function MeldReturnRelay({ checkoutId }: { checkoutId: string | null }) {
  const t = useExtracted()
  const router = useRouter()
  const [showCloseFallback, setShowCloseFallback] = useState(false)
  const isValidCheckoutId = isMeldCheckoutId(checkoutId)

  useEffect(() => {
    function goToStatus() {
      if (isValidCheckoutId && checkoutId) {
        router.replace({ pathname: '/', query: { meldCheckoutId: checkoutId } })
      } else {
        router.replace('/')
      }
    }

    if (!isValidCheckoutId || !checkoutId) {
      goToStatus()
      return
    }

    if (typeof BroadcastChannel === 'undefined') {
      goToStatus()
      return
    }

    const channel = new BroadcastChannel(MELD_CHECKOUT_RETURN_CHANNEL)
    let fallbackTimeout = window.setTimeout(goToStatus, 1_000)
    let closeFallbackTimeout: number | undefined
    let receivedAcknowledgement = false

    function handleMessage(event: MessageEvent<unknown>) {
      if (
        receivedAcknowledgement ||
        !isMeldCheckoutReturnMessage(event.data) ||
        event.data.type !== 'ack' ||
        event.data.checkoutId !== checkoutId
      ) {
        return
      }

      receivedAcknowledgement = true
      window.clearTimeout(fallbackTimeout)
      window.close()
      closeFallbackTimeout = window.setTimeout(() => setShowCloseFallback(true), 500)
    }

    channel.addEventListener('message', handleMessage)
    channel.postMessage({ type: 'return', checkoutId })
    return () => {
      window.clearTimeout(fallbackTimeout)
      if (closeFallbackTimeout !== undefined) {
        window.clearTimeout(closeFallbackTimeout)
      }
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [checkoutId, isValidCheckoutId, router])

  if (!showCloseFallback) {
    return null
  }

  return (
    <Dialog open onOpenChange={(open) => !open && router.replace('/')}>
      <DialogContent className="max-w-md" closeLabel={t('Close')}>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>Meld</DialogTitle>
          <DialogDescription>
            {t(
              'Your payment status is open in the original tab. Close this tab manually if it stays open, or go to the home page.',
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => router.replace('/')} variant="outline">
            {t('Go to home')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
