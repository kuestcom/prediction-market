'use client'

import { ArrowDownToLineIcon, CheckIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { usePendingUsdcDeposit } from '@/hooks/usePendingUsdcDeposit'
import { formatCurrency } from '@/lib/formatters'

export default function PendingDepositBanner() {
  const t = useExtracted()
  const { pendingBalance, hasPendingDeposit } = usePendingUsdcDeposit()
  const [open, setOpen] = useState(false)

  const openDialog = useCallback(() => setOpen(true), [])
  const closeDialog = useCallback(() => setOpen(false), [])

  const formattedAmount = formatCurrency(pendingBalance.raw, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (!hasPendingDeposit) {
    return null
  }

  return (
    <>
      <Button
        className="h-11 w-full justify-between px-4 text-left"
        onClick={openDialog}
      >
        <span className="text-sm font-semibold">{t('Pending deposit')}</span>
        <ArrowDownToLineIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border bg-background p-8 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted text-foreground">
            <CheckIcon className="size-10" />
          </div>

          <p className="mt-6 text-base font-semibold text-foreground">
            {t('Pending deposit detected: {amount}', { amount: formattedAmount })}
          </p>

          <p className="mt-3 text-sm text-muted-foreground">
            {t('Pending USDC.e activation is temporarily unavailable for Deposit Wallet accounts.')}
          </p>

          <Button className="mt-6 h-11 w-full text-base" onClick={closeDialog}>
            {t('Close')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
