import type { ShareCardPayload } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import { CopyIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

interface PublicPositionsShareDialogProps {
  isMobile: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  shareCardUrl: string
  shareCardPayload: ShareCardPayload | null
  shareCardStatus: 'idle' | 'loading' | 'ready' | 'error'
  isCopying: boolean
  isSharing: boolean
  onCardLoaded: () => void
  onCardError: () => void
  onCopyImage: () => void
  onShareOnX: () => void
}

export default function PublicPositionsShareDialog({
  isMobile,
  isOpen,
  onOpenChange,
  shareCardUrl,
  shareCardPayload,
  shareCardStatus,
  isCopying,
  isSharing,
  onCardLoaded,
  onCardError,
  onCopyImage,
  onShareOnX,
}: PublicPositionsShareDialogProps) {
  const isShareReady = shareCardStatus === 'ready'
  const shareDialogBody = (
    <div className="space-y-4">
      <div
        className="relative flex min-h-55 items-center justify-center rounded-lg border bg-muted/30 p-3"
      >
        {shareCardUrl && (
          // eslint-disable-next-line next/no-img-element
          <img
            key={shareCardUrl}
            src={shareCardUrl}
            alt={`${shareCardPayload?.title ?? 'Position'} share card`}
            className={cn(
              'w-full max-w-md rounded-md shadow-sm transition-opacity',
              isShareReady ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={onCardLoaded}
            onError={onCardError}
          />
        )}
        {!isShareReady && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            {shareCardStatus === 'error'
              ? (
                  <span>Unable to generate share card.</span>
                )
              : (
                  <>
                    <Loader2Icon className="size-5 animate-spin" />
                    <span>Generating share card...</span>
                  </>
                )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCopyImage}
          disabled={!isShareReady || isCopying || isSharing}
        >
          {isCopying
            ? <Loader2Icon className="size-4 animate-spin" />
            : <CopyIcon className="size-4" />}
          {isCopying ? 'Copying...' : 'Copy image'}
        </Button>
        <Button
          className="flex-1"
          onClick={onShareOnX}
          disabled={!isShareReady || isCopying || isSharing}
        >
          {isSharing
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
          {isSharing ? 'Opening...' : 'Share'}
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background">
          <DrawerHeader className="text-center sm:text-center">
            <DrawerTitle className="text-xl font-semibold">Shill your bag</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-6">
            {shareDialogBody}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md space-y-4">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-semibold">Shill your bag</DialogTitle>
        </DialogHeader>
        {shareDialogBody}
      </DialogContent>
    </Dialog>
  )
}
