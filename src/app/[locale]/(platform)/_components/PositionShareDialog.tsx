'use client'

import type { ShareCardPayload } from '@/lib/share-card'
import { CopyIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/useIsMobile'
import { buildShareCardUrl } from '@/lib/share-card'
import { cn } from '@/lib/utils'

interface PositionShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: ShareCardPayload | null
}

export function PositionShareDialog({ open, onOpenChange, payload }: PositionShareDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const [shareCardStatus, setShareCardStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [shareCardBlob, setShareCardBlob] = useState<Blob | null>(null)
  const [isCopyingShareImage, setIsCopyingShareImage] = useState(false)
  const [isSharingOnX, setIsSharingOnX] = useState(false)

  const shareCardUrl = useMemo(() => {
    if (!payload) {
      return ''
    }
    return buildShareCardUrl(payload)
  }, [payload])

  const resetState = useCallback(() => {
    setShareCardStatus('idle')
    setShareCardBlob(null)
    setIsCopyingShareImage(false)
    setIsSharingOnX(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  useEffect(() => {
    if (!open || !shareCardUrl) {
      return
    }
    setShareCardStatus('loading')
  }, [open, shareCardUrl])

  useEffect(() => {
    if (!shareCardUrl || shareCardStatus !== 'ready') {
      setShareCardBlob(null)
      return
    }

    let isCancelled = false

    fetch(shareCardUrl, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Share card fetch failed.')
        }
        return await response.blob()
      })
      .then((blob) => {
        if (!isCancelled) {
          setShareCardBlob(blob)
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Failed to preload share card image.', error)
          setShareCardBlob(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [shareCardStatus, shareCardUrl])

  const handleShareCardLoaded = useCallback(() => {
    setShareCardStatus('ready')
  }, [])

  const handleShareCardError = useCallback(() => {
    setShareCardStatus('error')
    toast.error(t('Unable to generate a share card right now.'))
  }, [t])

  const handleCopyShareImage = useCallback(async () => {
    if (!shareCardUrl) {
      return
    }

    setIsCopyingShareImage(true)
    try {
      if (!shareCardBlob) {
        toast.info(t('Share card is still preparing. Try again in a moment.'))
        return
      }

      const blob = shareCardBlob.type ? shareCardBlob : new Blob([shareCardBlob], { type: 'image/png' })
      const filename = 'position.png'

      if (typeof window !== 'undefined' && window.isSecureContext && 'ClipboardItem' in window) {
        try {
          const clipboardItem = new ClipboardItem({ [blob.type || 'image/png']: blob })
          await navigator.clipboard.write([clipboardItem])
          toast.success(t('Share card copied to clipboard.'))
          return
        }
        catch (error) {
          console.warn('Clipboard write failed, falling back to download.', error)
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success(t('Share card downloaded.'))
    }
    catch (error) {
      console.error('Failed to copy share card image.', error)
      toast.error(t('Could not copy the share card image.'))
    }
    finally {
      setIsCopyingShareImage(false)
    }
  }, [shareCardBlob, shareCardUrl, t])

  const handleShareOnX = useCallback(() => {
    if (!payload) {
      return
    }

    setIsSharingOnX(true)
    try {
      const username = payload.userName?.trim() || 'user'
      const baseUrl = window.location.origin
      const profileUrl = `${baseUrl}/@${encodeURIComponent(username)}`
      const shareText = [
        t('I just put my money where my mouth is on @kuest.'),
        '',
        t('Trade against me: {url}', { url: profileUrl }),
      ].join('\n')

      const shareUrl = new URL('https://x.com/intent/tweet')
      shareUrl.searchParams.set('text', shareText)
      window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer')
    }
    finally {
      window.setTimeout(() => {
        setIsSharingOnX(false)
      }, 200)
    }
  }, [payload, t])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }, [onOpenChange, resetState])

  const isShareReady = shareCardStatus === 'ready'
  const shareDialogBody = (
    <div className="space-y-3">
      <div className="relative flex min-h-55 items-center justify-center rounded-lg border bg-muted/30 p-3">
        {shareCardUrl && (
          // eslint-disable-next-line next/no-img-element
          <img
            key={shareCardUrl}
            src={shareCardUrl}
            alt={t('{title} share card', { title: payload?.title ?? t('Position') })}
            className={cn(
              'w-full max-w-md rounded-md shadow transition-opacity',
              isShareReady ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={handleShareCardLoaded}
            onError={handleShareCardError}
          />
        )}
        {!isShareReady && (
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground
          `}
          >
            {shareCardStatus === 'error'
              ? (
                  <span>{t('Unable to generate share card.')}</span>
                )
              : (
                  <>
                    <Loader2Icon className="size-5 animate-spin" />
                    <span>{t('Generating share card...')}</span>
                  </>
                )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleCopyShareImage}
          disabled={!isShareReady || isCopyingShareImage || isSharingOnX}
        >
          {isCopyingShareImage
            ? <Loader2Icon className="size-4 animate-spin" />
            : <CopyIcon className="size-4" />}
          {isCopyingShareImage ? t('Copying...') : t('Copy image')}
        </Button>
        <Button
          className="flex-1"
          onClick={handleShareOnX}
          disabled={!isShareReady || isCopyingShareImage || isSharingOnX}
        >
          {isSharingOnX
            ? <Loader2Icon className="size-4 animate-spin" />
            : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 251 256"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path
                    d="M149.079 108.399L242.33 0h-22.098l-80.97 94.12L74.59 0H0l97.796 142.328L0 256h22.1l85.507-99.395L175.905 256h74.59L149.073 108.399zM118.81 143.58l-9.909-14.172l-78.84-112.773h33.943l63.625 91.011l9.909 14.173l82.705 118.3H186.3l-67.49-96.533z"
                    fill="currentColor"
                  />
                </svg>
              )}
          {isSharingOnX ? t('Opening...') : t('Share')}
        </Button>
      </div>
    </div>
  )

  return isMobile
    ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[90vh] w-full bg-background">
            <DrawerHeader className="p-3 text-center sm:text-center">
              <DrawerTitle className="text-xl font-semibold">{t('Shill your bag')}</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-3 px-4 pb-2">
              {shareDialogBody}
            </div>
          </DrawerContent>
        </Drawer>
      )
    : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-md gap-2 p-4">
            <DialogHeader className="gap-1 text-center sm:text-center">
              <DialogTitle className="text-xl font-semibold">{t('Shill your bag')}</DialogTitle>
            </DialogHeader>
            {shareDialogBody}
          </DialogContent>
        </Dialog>
      )
}
