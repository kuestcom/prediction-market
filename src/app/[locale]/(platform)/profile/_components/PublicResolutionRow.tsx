'use client'

import type { Route } from 'next'

import { BadgeCheckIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import { resolveResolutionProposalValue } from '@/app/[locale]/(platform)/profile/_utils/PublicResolutionUtils'
import EventIconImage from '@/components/EventIconImage'
import { Link } from '@/i18n/navigation'
import { resolveEventMarketPath } from '@/lib/events-routing'
import { formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export default function PublicResolutionRow({ proposal }: { proposal: DataApiRewardProposal }) {
  const t = useExtracted()
  const market = proposal.market
  const isYes = proposal.side === 2
  const proposedLabel = isYes ? market.yesLabel || 'YES' : market.noLabel || 'NO'
  const marketTitle = market.title || market.eventTitle || t('Resolution proposal')
  const marketHref =
    market.eventSlug && market.marketSlug
      ? (resolveEventMarketPath(
          {
            slug: market.eventSlug,
            main_tag: null,
            sports_event_slug: null,
            sports_sport_slug: null,
            sports_league_slug: null,
          },
          market.marketSlug,
        ) as Route)
      : null
  const marketIcon = market.icon || market.eventIcon
  const submittedAtMs = Number(proposal.submittedAt) * 1_000
  const submittedAt = Number.isFinite(submittedAtMs) ? new Date(submittedAtMs).toISOString() : null
  const value = resolveResolutionProposalValue(proposal)

  const marketContent = (
    <div className="flex min-w-0 items-center gap-2.5 pl-1">
      {marketIcon ? (
        <EventIconImage
          src={marketIcon}
          alt={marketTitle}
          sizes="48px"
          containerClassName="size-12 shrink-0 rounded-sm"
        />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
          <BadgeCheckIcon className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm/tight font-semibold text-foreground" title={marketTitle}>
        {marketTitle}
      </span>
    </div>
  )

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="px-2 py-3 text-sm font-semibold sm:px-3">
        <span className={isYes ? 'text-yes' : 'text-no'}>{proposedLabel}</span>
      </td>
      <td className="max-w-0 px-2 py-3 sm:px-3">
        {marketHref ? (
          <Link href={marketHref} className="block rounded-sm underline-offset-2 hover:underline">
            {marketContent}
          </Link>
        ) : (
          marketContent
        )}
      </td>
      <td
        className={cn(
          'px-2 py-3 text-right text-sm font-semibold tabular-nums sm:px-3',
          value.positive ? 'text-yes' : 'text-foreground',
        )}
      >
        {value.label}
      </td>
      <td className="px-2 py-3 text-right text-xs text-muted-foreground sm:px-3">
        {submittedAt ? formatTimeAgo(submittedAt) : '—'}
      </td>
    </tr>
  )
}
