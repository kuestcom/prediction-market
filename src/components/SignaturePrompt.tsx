'use client'

import { Loader2Icon, WalletIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSignaturePrompt } from '@/stores/useSignaturePrompt'

export function SignaturePrompt() {
  const t = useExtracted()
  const open = useSignaturePrompt(state => state.open)
  const title = useSignaturePrompt(state => state.title)
  const description = useSignaturePrompt(state => state.description)
  const forceHidePrompt = useSignaturePrompt(state => state.forceHidePrompt)
  const defaultTitle = t('Requesting Signature')
  const defaultDescription = t('Open your wallet and approve the signature to continue.')

  const resolvedTitle = title === 'Requesting Signature'
    ? defaultTitle
    : title
  const resolvedDescription = description === 'Open your wallet and approve the signature to continue.'
    ? defaultDescription
    : description

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      forceHidePrompt()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="
          w-[320px] max-w-[calc(100%-2rem)] rounded-2xl border border-border/80 bg-background p-6 shadow-2xl
          sm:w-[340px]
        "
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogClose
          className="
            absolute top-5 right-5 z-20 inline-flex size-9 items-center justify-center rounded-md p-2
            text-muted-foreground/80 transition
            hover:bg-muted hover:text-foreground
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none
          "
          aria-label={t('Close')}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </DialogClose>

        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-center text-xl font-bold">{resolvedTitle}</DialogTitle>
        </DialogHeader>

        <div className="mt-3 flex flex-col items-center gap-5">
          <div className="relative size-32 overflow-hidden rounded-[28px] bg-background text-primary">
            <div
              className="
                pointer-events-none absolute inset-0 animate-[spin_1400ms_linear_infinite]
                bg-[conic-gradient(from_0deg,transparent_0deg,transparent_292deg,currentColor_315deg,currentColor_350deg,transparent_360deg)]
              "
            />
            <div className="absolute inset-[3px] rounded-[23px] bg-background" />
            <div className="relative flex size-full items-center justify-center">
              <div className="flex size-[90%] items-center justify-center rounded-[24px] bg-background shadow-sm">
                <WalletIcon className="size-16 text-primary" strokeWidth={1.8} />
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Loader2Icon className="size-4 animate-spin text-primary" />
              <span>{t('Waiting for approval')}</span>
            </div>
            <p className="max-w-64 text-sm/relaxed text-muted-foreground">
              {resolvedDescription}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
