'use client'

import { LockKeyholeIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import { formatSharesLabel } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export default function OtherOutcomeRow({ shares, showMarketIcon }: { shares: number; showMarketIcon?: boolean }) {
  const t = useExtracted()
  const sharesLabel = formatSharesLabel(shares, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div
      className={cn(
        `relative z-0 flex w-full cursor-default flex-col items-start py-3 pr-2 pl-4 transition-all duration-200 ease-in-out before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-lg before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] hover:before:opacity-100 lg:flex-row lg:items-center lg:rounded-lg lg:px-0 dark:before:bg-white/5`,
      )}
    >
      <div className="flex w-full flex-col gap-2 lg:w-2/5">
        <div className="flex items-start gap-3">
          {showMarketIcon && <div className="size-10.5 shrink-0 rounded-md bg-muted/60" aria-hidden="true" />}
          <div className="text-sm font-bold text-foreground">{t('Other')}</div>
        </div>
        <div>
          <span
            className={cn(
              `inline-flex items-center gap-1 rounded-sm bg-yes/15 px-1.5 py-0.5 text-xs/tight font-semibold text-yes-foreground`,
            )}
          >
            <LockKeyholeIcon className="size-3 text-yes" />
            <span className="tabular-nums">{sharesLabel}</span>
            <span>{t('Yes')}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
