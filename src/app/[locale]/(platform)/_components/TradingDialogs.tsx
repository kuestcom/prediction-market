'use client'

import type { ComponentProps } from 'react'
import { CircleDollarSignIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/useIsMobile'

interface FundAccountDialogProps {
  open: boolean
  onOpenChange: ComponentProps<typeof Dialog>['onOpenChange']
  onDeposit: () => void
}

export function FundAccountDialog({
  open,
  onOpenChange,
  onDeposit,
}: FundAccountDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6 text-center">
          <div className="space-y-6">
            <DrawerHeader className="space-y-3 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CircleDollarSignIcon className="size-10" />
              </div>
              <DrawerTitle className="text-center text-2xl font-bold">{t('Fund Your Account')}</DrawerTitle>
            </DrawerHeader>

            <Button className="h-12 w-full text-base" onClick={onDeposit}>
              {t('Deposit')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border bg-background p-8 text-center">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleDollarSignIcon className="size-10" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold">{t('Fund Your Account')}</DialogTitle>
        </DialogHeader>

        <Button className="mt-6 h-12 w-full text-base" onClick={onDeposit}>
          {t('Deposit')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
