'use client'

import type { ComponentProps } from 'react'
import { InfoIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PositionValueCellProps {
  valueLabel: string
  costLabel: string | null
  align?: 'start' | 'end'
  className?: string
  valueClassName?: string
  costClassName?: string
}

interface PositionReturnSummaryProps extends ComponentProps<'span'> {
  valueLabel: string
  percentLabel?: string | null
  valueClassName?: string
  percentClassName?: string
  underlineValue?: boolean
}

export function PositionValueCell({
  valueLabel,
  costLabel,
  align = 'start',
  className,
  valueClassName,
  costClassName,
}: PositionValueCellProps) {
  const t = useExtracted()

  return (
    <div className={cn('flex flex-col leading-tight', align === 'end' && 'items-end', className)}>
      <span className={valueClassName}>{valueLabel}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1 text-muted-foreground uppercase',
          align === 'end' && 'justify-end',
          costClassName,
        )}
      >
        <span>
          {costLabel
            ? t('Cost {amount}', { amount: costLabel })
            : t('Cost —')}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex size-3.5 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={t('Cost includes trading fees')}
            >
              <InfoIcon className="size-3" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-48 text-xs normal-case">
            {t('Cost includes trading fees paid on fills.')}
          </TooltipContent>
        </Tooltip>
      </span>
    </div>
  )
}

export function PositionReturnSummary({
  valueLabel,
  percentLabel = null,
  className,
  valueClassName,
  percentClassName,
  underlineValue = false,
  ref,
  ...spanProps
}: PositionReturnSummaryProps) {
  return (
    <span
      ref={ref}
      {...spanProps}
      className={cn('inline-flex flex-wrap items-center gap-1', className)}
    >
      <span
        className={cn(
          'inline-flex items-center',
          underlineValue && 'border-b border-dotted border-current pb-[0.04rem]',
          valueClassName,
        )}
      >
        {valueLabel}
      </span>
      {percentLabel && (
        <span className={percentClassName}>
          (
          {percentLabel}
          )
        </span>
      )}
    </span>
  )
}
