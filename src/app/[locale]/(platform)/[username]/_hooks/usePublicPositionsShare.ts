import type { PublicPosition } from '@/app/[locale]/(platform)/[username]/_components/PublicPositionItem'
import type { ShareCardPayload } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { buildShareCardPayload, buildShareCardUrl } from '@/app/[locale]/(platform)/[username]/_utils/PublicPositionsUtils'

interface UsePublicPositionsShareOptions {
  userName?: string | null
  userImage?: string | null
}

export function usePublicPositionsShare({ userName, userImage }: UsePublicPositionsShareOptions) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [sharePosition, setSharePosition] = useState<PublicPosition | null>(null)
  const [shareCardStatus, setShareCardStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [shareCardBlob, setShareCardBlob] = useState<Blob | null>(null)
  const [isCopyingShareImage, setIsCopyingShareImage] = useState(false)
  const [isSharingOnX, setIsSharingOnX] = useState(false)

  const shareCardPayload = useMemo<ShareCardPayload | null>(() => {
    if (!sharePosition) {
      return null
    }
    const payload = buildShareCardPayload(sharePosition)
    return {
      ...payload,
      userName: userName || undefined,
      userImage: userImage || undefined,
    }
  }, [sharePosition, userImage, userName])

  const shareCardUrl = useMemo(() => {
    if (!shareCardPayload) {
      return ''
    }
    return buildShareCardUrl(shareCardPayload)
  }, [shareCardPayload])

  useEffect(() => {
    if (!isShareDialogOpen || !shareCardUrl) {
      return
    }
    setShareCardStatus('loading')
  }, [isShareDialogOpen, shareCardUrl])

  useEffect(() => {
    if (!shareCardUrl || shareCardStatus !== 'ready') {
      setShareCardBlob(null)
      return
    }

    let isCancelled = false

    fetch(shareCardUrl)
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

  const handleShareOpenChange = useCallback((open: boolean) => {
    setIsShareDialogOpen(open)
    if (!open) {
      setSharePosition(null)
      setShareCardStatus('idle')
      setShareCardBlob(null)
      setIsCopyingShareImage(false)
      setIsSharingOnX(false)
    }
  }, [])

  const handleShareClick = useCallback((position: PublicPosition) => {
    setSharePosition(position)
    setIsShareDialogOpen(true)
  }, [])

  const handleShareCardLoaded = useCallback(() => {
    setShareCardStatus('ready')
  }, [])

  const handleShareCardError = useCallback(() => {
    setShareCardStatus('error')
    toast.error('Unable to generate a share card right now.')
  }, [])

  const handleCopyShareImage = useCallback(async () => {
    if (!shareCardUrl) {
      return
    }

    setIsCopyingShareImage(true)
    try {
      if (!shareCardBlob) {
        toast.info('Share card is still preparing. Try again in a moment.')
        return
      }

      const blob = shareCardBlob.type ? shareCardBlob : new Blob([shareCardBlob], { type: 'image/png' })
      const filename = 'position.png'

      if (typeof window !== 'undefined' && window.isSecureContext && 'ClipboardItem' in window) {
        try {
          const clipboardItem = new ClipboardItem({ [blob.type || 'image/png']: blob })
          await navigator.clipboard.write([clipboardItem])
          toast.success('Share card copied to clipboard.')
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
      toast.success('Share card downloaded.')
    }
    catch (error) {
      console.error('Failed to copy share card image.', error)
      toast.error('Could not copy the share card image.')
    }
    finally {
      setIsCopyingShareImage(false)
    }
  }, [shareCardBlob, shareCardUrl])

  const handleShareOnX = useCallback(() => {
    if (!shareCardPayload || !shareCardUrl) {
      return
    }

    setIsSharingOnX(true)
    try {
      const outcomeLabel = shareCardPayload.outcome.toUpperCase()
      const shareText = `Bought ${outcomeLabel} on "${shareCardPayload.title}".`
      const baseUrl = window.location.origin
      const shareCardAbsoluteUrl = new URL(shareCardUrl, baseUrl).toString()

      const shareUrl = new URL('https://x.com/intent/tweet')
      shareUrl.searchParams.set('text', shareText)
      shareUrl.searchParams.set('url', shareCardAbsoluteUrl)
      window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer')
    }
    finally {
      setIsSharingOnX(false)
    }
  }, [shareCardPayload, shareCardUrl])

  return {
    isShareDialogOpen,
    shareCardUrl,
    shareCardPayload,
    shareCardStatus,
    isCopyingShareImage,
    isSharingOnX,
    handleShareOpenChange,
    handleShareClick,
    handleShareCardLoaded,
    handleShareCardError,
    handleCopyShareImage,
    handleShareOnX,
  }
}
