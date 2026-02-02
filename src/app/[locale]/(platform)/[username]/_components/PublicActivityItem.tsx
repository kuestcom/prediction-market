import type { Route } from 'next'
import type { PublicActivity } from '@/types'
import { SquareArrowOutUpRightIcon } from 'lucide-react'
import Image from 'next/image'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { Link } from '@/i18n/navigation'
import { formatCurrency, formatSharePriceLabel, formatSharesLabel, formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function PublicActivityItem({ item }: { item: PublicActivity }) {
  const normalizeOutcomeLabel = useOutcomeLabel()
  const isSplit = item.type === 'split'
  const eventSlug = item.eventSlug || item.slug
  const marketSlug = item.eventSlug ? item.slug : null
  const eventHref = (marketSlug ? `/event/${eventSlug}/${marketSlug}` : `/event/${eventSlug}`) as Route
  const rawOutcomeText = item.outcomeText || 'Outcome'
  const outcomeText = normalizeOutcomeLabel(item.outcomeText) ?? rawOutcomeText
  const outcomeChipColor = rawOutcomeText.toLowerCase() === 'yes'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  const totalValueUsd = item.usdcValue

  return (
    <div className={`
      flex items-center gap-3 border-b border-border px-3 py-4 transition-colors
      last:border-b-0
      hover:bg-accent/50
      sm:gap-4 sm:px-5
    `}
    >

      <div className="w-12 shrink-0 sm:w-16">
        <span className="text-xs font-medium capitalize sm:text-sm">{item.type}</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link
          href={eventHref}
          className="size-10 shrink-0 overflow-hidden rounded-sm bg-muted sm:size-12"
        >
          <Image
            src={`https://gateway.irys.xyz/${item.icon}`}
            alt={item.title}
            width={48}
            height={48}
            className="size-full object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <h4 className="mb-1 line-clamp-2 text-xs font-medium sm:text-sm">
            <Link
              href={eventHref}
              className="underline-offset-2 hover:underline"
            >
              {item.title}
            </Link>
          </h4>

          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-2">
            {isSplit
              ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`
                      inline-flex w-fit items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium
                      text-green-800
                      dark:bg-green-900/30 dark:text-green-300
                    `}
                    >
                      {normalizeOutcomeLabel('Yes') ?? 'Yes'}
                      {' '}
                      {formatSharePriceLabel(0.5)}
                    </span>
                    <span className={`
                      inline-flex w-fit items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800
                      dark:bg-red-900/30 dark:text-red-300
                    `}
                    >
                      {normalizeOutcomeLabel('No') ?? 'No'}
                      {' '}
                      {formatSharePriceLabel(0.5)}
                    </span>
                  </div>
                )
              : (
                  <span className={cn(
                    'inline-flex w-fit rounded-md px-2 py-1 text-xs font-medium',
                    outcomeChipColor,
                  )}
                  >
                    {outcomeText}
                    {' '}
                    {formatSharePriceLabel(item.price == null ? null : Number(item.price))}
                  </span>
                )}
            {typeof item.shares === 'number' && (
              <span className="text-xs font-semibold text-muted-foreground">
                {formatSharesLabel(item.shares)}
                {' '}
                shares
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-1 text-right">
        <div className="text-xs font-semibold sm:text-sm">
          {formatCurrency(totalValueUsd)}
        </div>
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {formatTimeAgo(new Date(item.timestamp).toISOString())}
          </span>
          <a
            href={`https://polygonscan.com/tx/${item.txHash ?? item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="View on Polygonscan"
            aria-label={`View transaction ${item.txHash ?? item.id} on Polygonscan`}
          >
            <SquareArrowOutUpRightIcon className="size-3" />
          </a>
        </div>

        <div className="text-xs text-muted-foreground sm:hidden">
          {formatTimeAgo(item.timestamp.toString())}
        </div>
      </div>
    </div>
  )
}
