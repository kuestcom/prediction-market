'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { ArrowUpDownIcon, EyeIcon, EyeOffIcon, RadioIcon, RepeatIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'
import { formatCompactCurrency, formatDate } from '@/lib/formatters'

interface EventColumnOptions {
  onToggleHidden: (event: AdminEventRow, nextValue: boolean) => void
  onOpenLivestreamModal: (event: AdminEventRow) => void
  isUpdatingHidden: (eventId: string) => boolean
}

function resolveStatusVariant(status: AdminEventRow['status']): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'active') {
    return 'default'
  }
  if (status === 'resolved') {
    return 'secondary'
  }
  if (status === 'archived') {
    return 'outline'
  }
  return 'destructive'
}

function formatSeriesRecurrenceLabel(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d+[a-z]+$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  return `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1)}`
}

export function useAdminEventsColumns({
  onToggleHidden,
  onOpenLivestreamModal,
  isUpdatingHidden,
}: EventColumnOptions): ColumnDef<AdminEventRow>[] {
  const t = useExtracted()

  return [
    {
      accessorKey: 'title',
      id: 'title',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto gap-0 p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('Event')}
          <ArrowUpDownIcon className="size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const event = row.original
        return (
          <div className="min-w-[18rem]">
            <div className="flex items-start gap-3">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                {event.icon_url
                  ? (
                      <Image
                        src={event.icon_url}
                        alt={event.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )
                  : (
                      <div className="
                        flex size-full items-center justify-center text-xs font-semibold text-muted-foreground
                      "
                      >
                        {event.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/event/${event.slug}`}
                    className={`
                      truncate text-sm font-medium underline-offset-4 hover:underline
                      ${event.is_hidden ? 'text-muted-foreground' : 'text-foreground'}
                    `}
                  >
                    {event.title}
                  </Link>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{event.slug}</span>
                  {event.series_slug && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center text-muted-foreground">
                          <RepeatIcon className="size-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatSeriesRecurrenceLabel(event.series_recurrence ?? event.series_slug) ?? t('Series')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      },
      enableHiding: false,
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto gap-0 p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('Status')}
          <ArrowUpDownIcon className="size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const event = row.original
        return (
          <Badge variant={resolveStatusVariant(event.status)} className="capitalize">
            {event.status}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'volume',
      id: 'volume',
      header: () => (
        <div className="text-xs font-medium text-muted-foreground uppercase">
          {t('Volume (24h/Total)')}
        </div>
      ),
      cell: ({ row }) => {
        const event = row.original
        return (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {formatCompactCurrency(event.volume_24h)}
            {' / '}
            {formatCompactCurrency(event.volume)}
          </span>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'created_at',
      id: 'created_at',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto gap-0 p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('Created')}
          <ArrowUpDownIcon className="size-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {formatDate(new Date(row.original.created_at))}
        </span>
      ),
    },
    {
      accessorKey: 'end_date',
      id: 'end_date',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto gap-0 p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('End')}
          <ArrowUpDownIcon className="size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const endDate = row.original.end_date ? new Date(row.original.end_date) : null
        return (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {endDate ? formatDate(endDate) : t('Not set')}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: () => (
        <div className="text-center text-xs font-medium text-muted-foreground uppercase">
          {t('Actions')}
        </div>
      ),
      cell: ({ row }) => {
        const event = row.original
        const hiddenUpdatePending = isUpdatingHidden(event.id)
        const nextHiddenState = !event.is_hidden

        return (
          <div className="flex items-center justify-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onOpenLivestreamModal(event)}
                  aria-label={event.livestream_url ? t('Edit livestream URL') : t('Add livestream URL')}
                >
                  <RadioIcon className={`size-4 ${event.livestream_url ? 'text-red-500' : 'text-muted-foreground'}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {event.livestream_url ? t('Edit livestream URL') : t('Add livestream URL')}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`size-8 ${event.is_hidden ? 'text-red-500 hover:text-red-500' : 'text-muted-foreground'}`}
                  onClick={() => onToggleHidden(event, nextHiddenState)}
                  disabled={hiddenUpdatePending}
                  aria-label={event.is_hidden ? t('Show event') : t('Hide event')}
                >
                  {event.is_hidden ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {event.is_hidden ? t('Show event') : t('Hide event')}
              </TooltipContent>
            </Tooltip>
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
