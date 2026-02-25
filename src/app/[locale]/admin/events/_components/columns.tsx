'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { ArrowUpDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Link } from '@/i18n/navigation'
import { formatCompactCurrency, formatDate } from '@/lib/formatters'

interface EventColumnOptions {
  onToggleHidden: (event: AdminEventRow, nextValue: boolean) => void
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

export function useAdminEventsColumns({
  onToggleHidden,
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
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('Event')}
          <ArrowUpDownIcon className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const event = row.original
        return (
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/event/${event.slug}`}
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                {event.title}
              </Link>
              {event.is_hidden && (
                <Badge variant="outline" className="text-xs">
                  {t('Hidden')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {`slug: ${event.slug}`}
            </p>
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
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('Status')}
          <ArrowUpDownIcon className="ml-2 size-4" />
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
      accessorKey: 'volume_24h',
      id: 'volume_24h',
      header: () => (
        <div className="text-xs font-medium text-muted-foreground uppercase">
          {t('Volume (24h)')}
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatCompactCurrency(row.original.volume_24h)}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'volume',
      id: 'volume',
      header: () => (
        <div className="text-xs font-medium text-muted-foreground uppercase">
          {t('Volume (Total)')}
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatCompactCurrency(row.original.volume)}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'updated_at',
      id: 'updated_at',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          {t('Updated')}
          <ArrowUpDownIcon className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const event = row.original
        return (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {formatDate(new Date(event.updated_at))}
          </span>
        )
      },
    },
    {
      accessorKey: 'is_hidden',
      id: 'is_hidden',
      header: () => (
        <div className="text-center text-xs font-medium text-muted-foreground uppercase">
          {t('Hide Event')}
        </div>
      ),
      cell: ({ row }) => {
        const event = row.original
        const disabled = isUpdatingHidden(event.id)
        return (
          <div className="text-center">
            <Switch
              id={`hide-event-${event.id}`}
              checked={event.is_hidden}
              disabled={disabled}
              onCheckedChange={checked => onToggleHidden(event, checked)}
            />
            <span className="sr-only">
              {t('Toggle hide for {name}', { name: event.title })}
            </span>
          </div>
        )
      },
      enableSorting: false,
    },
  ]
}
