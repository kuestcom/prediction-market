'use client'

import type { Comment, Market } from '@/types'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatCompactShares } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type RawPosition = NonNullable<Comment['positions']>[number]

export interface CommentPositionEntry {
  id: string
  amount: number
  amountLabel: string
  inlineLabel: string
  outcomeLabel: string
  marketLabel: string
  isYes: boolean
}

function toText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function toOptionalNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function toNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function resolveConditionId(position: RawPosition) {
  return toText(position.condition_id) || toText(position.conditionId)
}

function resolveOutcomeIndex(position: RawPosition) {
  if (position.outcome_index != null) {
    return toOptionalNumber(position.outcome_index)
  }
  if (position.outcomeIndex != null) {
    return toOptionalNumber(position.outcomeIndex)
  }
  return null
}

function resolveOutcomeLabel(outcomeIndex: number | null, market?: Market) {
  if (market && outcomeIndex != null) {
    const outcome = market.outcomes.find(item => item.outcome_index === outcomeIndex)
    const outcomeLabel = toText(outcome?.outcome_text)
    if (outcomeLabel) {
      return outcomeLabel
    }
  }
  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return 'No'
  }
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return 'Yes'
  }
  if (typeof outcomeIndex === 'number') {
    return `Outcome ${outcomeIndex + 1}`
  }
  return 'Outcome'
}

function resolveMarketLabel(market?: Market) {
  return toText(market?.short_title) || toText(market?.title)
}

function resolveIsYes(outcomeIndex: number | null, outcomeLabel: string) {
  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return false
  }
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return true
  }
  if (/\bno\b/i.test(outcomeLabel)) {
    return false
  }
  if (/\byes\b/i.test(outcomeLabel)) {
    return true
  }
  return true
}

function resolvePositionId(conditionId: string, outcomeIndex: number | null, index: number) {
  if (conditionId) {
    return outcomeIndex == null ? conditionId : `${conditionId}-${outcomeIndex}`
  }
  return `position-${index}`
}

export function getCommentPositionEntries(
  positions: Comment['positions'] | undefined,
  marketsByConditionId?: Map<string, Market>,
  isSingleMarket = false,
) {
  if (!Array.isArray(positions)) {
    return []
  }

  const entries = positions
    .map((position, index): CommentPositionEntry | null => {
      if (!position) {
        return null
      }

      const amount = toNumber(position.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return null
      }

      const conditionId = resolveConditionId(position)
      const outcomeIndex = resolveOutcomeIndex(position)
      const market = conditionId ? marketsByConditionId?.get(conditionId) : undefined
      const outcomeLabel = resolveOutcomeLabel(outcomeIndex, market)
      const marketLabel = resolveMarketLabel(market) || outcomeLabel
      const inlineLabel = isSingleMarket ? outcomeLabel : (marketLabel || outcomeLabel)
      const id = resolvePositionId(conditionId, outcomeIndex, index)
      const isYes = resolveIsYes(outcomeIndex, outcomeLabel)

      return {
        id,
        amount,
        amountLabel: formatCompactShares(amount),
        inlineLabel,
        outcomeLabel,
        marketLabel,
        isYes,
      }
    })
    .filter((entry): entry is CommentPositionEntry => Boolean(entry))

  return entries.sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount
    }
    return a.inlineLabel.localeCompare(b.inlineLabel)
  })
}

function CommentPositionBadgeContent({
  amountLabel,
  label,
}: {
  amountLabel: string
  label: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="shrink-0">{amountLabel}</span>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}

const badgeBaseClassName = 'inline-flex max-w-64 items-center rounded-sm px-2 py-0.5 text-xs font-semibold'

export function CommentPositionBadge({
  position,
  label,
  className,
  usePrimaryTone = false,
}: {
  position: CommentPositionEntry
  label?: string
  className?: string
  usePrimaryTone?: boolean
}) {
  const normalizeOutcomeLabel = useOutcomeLabel()
  const rawLabel = label ?? position.inlineLabel
  const displayLabel = normalizeOutcomeLabel(rawLabel) ?? rawLabel
  let badgeToneClass = 'bg-no/15 text-no-foreground'
  if (usePrimaryTone) {
    badgeToneClass = 'bg-primary/15 text-primary'
  }
  else if (position.isYes) {
    badgeToneClass = 'bg-yes/15 text-yes-foreground'
  }

  return (
    <span
      className={cn(
        badgeBaseClassName,
        badgeToneClass,
        className,
      )}
      title={`${position.amountLabel} ${displayLabel}`}
    >
      <CommentPositionBadgeContent amountLabel={position.amountLabel} label={displayLabel} />
    </span>
  )
}

export function CommentPositionsIndicator({
  positions,
  isSingleMarket = false,
  marketsByConditionId,
  usePrimaryTone = false,
}: {
  positions?: Comment['positions']
  isSingleMarket?: boolean
  marketsByConditionId?: Map<string, Market>
  usePrimaryTone?: boolean
}) {
  const normalizeOutcomeLabel = useOutcomeLabel()
  const entries = getCommentPositionEntries(positions, marketsByConditionId, isSingleMarket)
  const [open, setOpen] = useState(false)

  const primaryPosition = entries[0]
  const primaryInlineLabel = primaryPosition
    ? (normalizeOutcomeLabel(primaryPosition.inlineLabel) ?? primaryPosition.inlineLabel)
    : ''
  let primaryBadgeToneClass = 'bg-no/15 text-no-foreground'
  if (usePrimaryTone) {
    primaryBadgeToneClass = 'bg-primary/15 text-primary'
  }
  else if (primaryPosition?.isYes) {
    primaryBadgeToneClass = 'bg-yes/15 text-yes-foreground'
  }

  if (!primaryPosition) {
    return null
  }

  if (isSingleMarket || entries.length <= 1) {
    return <CommentPositionBadge position={primaryPosition} usePrimaryTone={usePrimaryTone} />
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            badgeBaseClassName,
            'gap-1 pr-1.5 transition-colors',
            primaryBadgeToneClass,
          )}
          aria-label={open ? 'Hide positions' : 'Show positions'}
          aria-expanded={open}
          title={`${primaryPosition.amountLabel} ${primaryInlineLabel}`}
        >
          <CommentPositionBadgeContent
            amountLabel={primaryPosition.amountLabel}
            label={primaryInlineLabel}
          />
          {open ? <ChevronUpIcon className="size-3 shrink-0" /> : <ChevronDownIcon className="size-3 shrink-0" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="max-w-72 min-w-56 border border-border bg-background p-2 text-foreground shadow-xl"
      >
        <div className="flex flex-col gap-2">
          {entries.map(position => (
            <div
              key={position.id}
              className="flex w-full min-w-0 items-center"
            >
              <span
                className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground"
                title={position.marketLabel}
              >
                {position.marketLabel}
              </span>
              <CommentPositionBadge
                position={position}
                label={position.outcomeLabel}
                className="ml-2 shrink-0"
                usePrimaryTone={usePrimaryTone}
              />
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
