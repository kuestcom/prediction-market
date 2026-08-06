'use client'

import { CheckIcon, ShareIcon } from 'lucide-react'

import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'

import { useSportsEventShareButton } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-hooks'
import { headerIconButtonClass } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

function SportsEventShareButton({ event }: { event: SportsGamesCard['event'] }) {
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() || user?.username?.trim() || ''
  const { shareSuccess, setShareSuccess, maybeHandleDebugCopy } = useSportsEventShareButton(event)

  async function handleShare() {
    try {
      const url = new URL(window.location.href)
      if (affiliateCode) {
        url.searchParams.set('r', affiliateCode)
      }
      await navigator.clipboard.writeText(url.toString())
      setShareSuccess(true)
      window.setTimeout(setShareSuccess, 2000, false)
    } catch {
      // noop
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(headerIconButtonClass, 'size-auto p-0')}
      aria-label="Copy event link"
      onClick={(event) => {
        if (maybeHandleDebugCopy(event)) {
          return
        }
        void handleShare()
      }}
    >
      {shareSuccess ? <CheckIcon className="size-4 text-primary" /> : <ShareIcon className="size-4" />}
    </Button>
  )
}

export default SportsEventShareButton
