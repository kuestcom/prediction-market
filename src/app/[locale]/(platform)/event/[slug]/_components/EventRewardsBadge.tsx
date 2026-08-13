'use client'

import { GiftIcon, SparklesIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { MarketRewardConfig } from '@/lib/clob-rewards'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventRewardsBadgeProps {
  rewards: MarketRewardConfig[]
  compact?: boolean
  active?: boolean
  onHighlightChange?: (active: boolean) => void
}

export default function EventRewardsBadge({
  rewards,
  compact = false,
  active = false,
  onHighlightChange,
}: EventRewardsBadgeProps) {
  const t = useExtracted()
  if (!rewards.length) {
    return null
  }

  const dailyRate = rewards.reduce((total, reward) => total + reward.dailyRate, 0)
  const dailyRateLabel = formatCurrency(dailyRate, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const minSpread = Math.min(...rewards.map((reward) => reward.maxSpread).filter((value) => value > 0))
  const minSize = Math.min(...rewards.map((reward) => reward.minSize).filter((value) => value > 0))

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              compact
                ? 'group inline-flex min-h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-violet-500/20 bg-violet-500/5 px-1.5 text-xs font-semibold text-violet-500 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10'
                : 'inline-flex h-7 items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 px-2 text-xs font-semibold text-violet-500 transition-colors hover:border-violet-500/50 hover:bg-violet-500/15',
              active && 'border-violet-500/50 bg-violet-500/15',
            )}
            aria-label={t('Liquidity rewards')}
            onPointerEnter={() => onHighlightChange?.(true)}
            onPointerLeave={() => onHighlightChange?.(false)}
            onFocus={() => onHighlightChange?.(true)}
            onBlur={() => onHighlightChange?.(false)}
          >
            {compact ? (
              <GiftIcon className="size-3.5" aria-hidden />
            ) : (
              <SparklesIcon className="size-3.5" aria-hidden />
            )}
            {compact ? (
              <span className="inline-flex min-w-0 items-center">
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-200 group-hover:mr-1 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:mr-1 group-focus-visible:max-w-40 group-focus-visible:opacity-100 [@media(hover:none)]:mr-1 [@media(hover:none)]:max-w-40 [@media(hover:none)]:opacity-100">
                  {t('Liquidity Rewards')}
                </span>
                <span className="tabular-nums">{dailyRateLabel}</span>
              </span>
            ) : (
              <span>{t('Rewards')}</span>
            )}
          </button>
        }
      />
      <TooltipContent
        side="top"
        align="end"
        collisionPadding={16}
        className="w-64 overflow-hidden rounded-xl border-violet-500/55 bg-popover p-0 text-left font-normal shadow-2xl"
      >
        <div className="p-4">
          <p className="text-center text-sm leading-5 font-medium text-foreground">
            {t('Earn rewards by placing limit orders near the midpoint.')}
          </p>

          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t('Daily rewards')}</span>
              <span className="inline-flex items-center gap-1 font-semibold text-violet-500">
                <GiftIcon className="size-3.5" aria-hidden />
                {dailyRateLabel}
              </span>
            </div>
            {Number.isFinite(minSpread) && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t('Max spread')}</span>
                <span className="font-medium text-foreground">±{minSpread}¢</span>
              </div>
            )}
            {Number.isFinite(minSize) && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t('Min shares')}</span>
                <span className="font-medium text-foreground">{minSize}</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
