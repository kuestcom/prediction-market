'use client'

import type { Route } from 'next'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { formatCurrency, formatSharesLabel, formatTimeAgo } from '@/lib/formatters'

export interface PublicPosition {
  id: string
  title: string
  slug: string
  eventSlug: string
  icon?: string
  avgPrice: number
  currentValue: number
  timestamp: number
  status: 'active' | 'closed'
  outcome?: string
  conditionId?: string
  mergeable?: boolean
  outcomeIndex?: number
  oppositeOutcome?: string
  asset?: string
  oppositeAsset?: string
  size?: number
  curPrice?: number
}

interface PositionItemProps {
  item: PublicPosition
}

export default function PublicPositionItem({ item }: PositionItemProps) {
  const eventSlug = item.eventSlug || item.slug
  const marketSlug = item.eventSlug && item.slug ? item.slug : null
  const eventHref = (marketSlug ? `/event/${eventSlug}/${marketSlug}` : `/event/${eventSlug}`) as Route

  return (
    <div className={`
      flex items-center gap-3 border-b border-border px-3 py-4 transition-colors
      last:border-b-0
      hover:bg-accent/50
      sm:gap-4 sm:px-5
    `}
    >
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
            <span className={`
              inline-flex w-fit rounded-md px-2 py-1 text-xs font-medium
              ${item.status === 'active'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
            `}
            >
              {item.status === 'active' ? 'Active' : 'Closed'}
            </span>

            {typeof item.size === 'number' && (
              <span className="text-xs text-muted-foreground">
                Size:
                {' '}
                {formatSharesLabel(item.size)}
              </span>
            )}

            {item.outcome && (
              <span className="text-xs text-muted-foreground">
                Outcome:
                {' '}
                {item.outcome}
              </span>
            )}

            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatTimeAgo(new Date(item.timestamp).toISOString())}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold sm:text-sm">
          {formatCurrency(item.avgPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted-foreground">Avg Price</div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold sm:text-sm">
          {formatCurrency(item.currentValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.status === 'closed' ? 'Realized' : 'Value'}
        </div>

        <div className="text-xs text-muted-foreground sm:hidden">
          {formatTimeAgo(item.timestamp.toString())}
        </div>
      </div>
    </div>
  )
}
