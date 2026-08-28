'use client'

import { XIcon } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/useIsMobile'

export interface MarketMakingHowItWorksCopy {
  title: string
  description: string
  fundsTitle: string
  fundsDescription: string
  cancellationTitle: string
  cancellationDescription: string
  disputesTitle: string
  disputesDescription: string
  close: string
}

export default function MarketMakingHowItWorks({
  open,
  onOpenChange,
  copy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  copy: MarketMakingHowItWorksCopy
}) {
  const isMobile = useIsMobile()
  const content = (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
      <div className="overflow-hidden rounded-xl border bg-muted/15 p-3 sm:p-4">
        <Image
          src="/images/how-it-works/escrow.svg"
          alt=""
          width={1394}
          height={425}
          className="mx-auto block h-auto w-full max-w-[920px]"
          aria-hidden="true"
          unoptimized
        />
      </div>

      <Tabs defaultValue="funds" className="mt-4">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="funds" className="min-h-9 px-2 text-xs sm:text-sm">
            {copy.fundsTitle}
          </TabsTrigger>
          <TabsTrigger value="cancellation" className="min-h-9 px-2 text-xs sm:text-sm">
            {copy.cancellationTitle}
          </TabsTrigger>
          <TabsTrigger value="disputes" className="min-h-9 px-2 text-xs sm:text-sm">
            {copy.disputesTitle}
          </TabsTrigger>
        </TabsList>
        <div className="min-h-24 px-1 pt-1">
          <TabsContent value="funds" className="mt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.fundsDescription}</p>
          </TabsContent>
          <TabsContent value="cancellation" className="mt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.cancellationDescription}</p>
          </TabsContent>
          <TabsContent value="disputes" className="mt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.disputesDescription}</p>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[92dvh] flex-col overflow-hidden bg-background">
          <DrawerHeader className="pr-14 text-left">
            <DrawerTitle>{copy.title}</DrawerTitle>
            <DrawerDescription>{copy.description}</DrawerDescription>
          </DrawerHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-10"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-5" />
            <span className="sr-only">{copy.close}</span>
          </Button>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[min(820px,calc(100vw-2rem))] sm:max-w-none">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
