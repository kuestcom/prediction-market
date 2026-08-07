'use client'

import { DownloadIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'

import PwaInstallIosInstructions from '@/components/PwaInstallIosInstructions'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { cn } from '@/lib/utils'

interface PwaInstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function PwaInstallDialogBody() {
  const t = useExtracted()
  const site = useSiteIdentity()

  return (
    <div className="relative overflow-hidden px-6 pt-4 pb-7">
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <Image
            src={site.pwaIcon192Url}
            alt={t('PWA icon 192x192')}
            width={56}
            height={56}
            className="size-14 rounded-xl object-cover"
            unoptimized
          />
          <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-sky-500 text-white shadow-sm">
            <DownloadIcon className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>

        <div className="w-full max-w-sm text-left text-sm leading-6 text-muted-foreground">
          <PwaInstallIosInstructions className="items-start" />
        </div>
      </div>
    </div>
  )
}

export default function PwaInstallDialog({ open, onOpenChange }: PwaInstallDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const title = t('Install app')

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="overflow-hidden border-border/70 bg-background px-0 pt-3 pb-0 shadow-2xl">
          <button
            type="button"
            aria-label={t('Close')}
            onClick={() => onOpenChange(false)}
            className={cn(
              `absolute top-4 right-4 z-10 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none`,
            )}
          >
            <XIcon className="size-4" />
          </button>
          <DrawerHeader className="items-center px-6 pt-3 pb-0 text-center">
            <DrawerTitle className="text-center text-xl font-bold">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          </DrawerHeader>
          <PwaInstallDialogBody />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[26rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-border/70 bg-background p-0 shadow-2xl"
      >
        <DialogClose
          aria-label={t('Close')}
          className={cn(
            `absolute top-4 right-4 z-10 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none`,
          )}
        >
          <XIcon className="size-4" />
        </DialogClose>
        <DialogHeader className="items-center px-6 pt-8 text-center">
          <DialogTitle className="text-center text-xl font-bold">{title}</DialogTitle>
        </DialogHeader>
        <PwaInstallDialogBody />
      </DialogContent>
    </Dialog>
  )
}
