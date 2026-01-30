'use client'

import type { ConditionChangeLogEntry, Market } from '@/types'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { tableHeaderClass } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface EventChangeLogProps {
  entries: ConditionChangeLogEntry[]
  markets: Market[]
}

function formatTimestamp(value: string, fallbackLabel: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallbackLabel
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatChangeValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'string') {
    return value.length > 0 ? value : '—'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

function formatConditionLabel(conditionId: string, market?: Market) {
  if (market?.short_title) {
    return market.short_title
  }
  if (market?.title) {
    return market.title
  }

  if (!conditionId) {
    return '—'
  }

  const prefix = conditionId.slice(0, 6)
  const suffix = conditionId.slice(-4)
  return `${prefix}...${suffix}`
}

export default function EventChangeLog({ entries, markets }: EventChangeLogProps) {
  const t = useExtracted()
  const marketLookup = useMemo(() => {
    return new Map(markets.map(market => [market.condition_id, market]))
  }, [markets])
  const rows = useMemo(() => {
    return entries.flatMap((entry) => {
      const fields = Object.keys(entry.new_values ?? {})
        .filter(field => field !== 'updated_at')
        .sort()

      return fields.map((field, index) => ({
        entry,
        field,
        isFirst: index === 0,
        rowSpan: fields.length,
      }))
    })
  }, [entries])

  if (entries.length === 0) {
    return null
  }

  const updateLabel = entries.length === 1 ? t('Update') : t('Updates')

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-medium">{t('Event changes')}</h3>
        <span className="text-xs text-muted-foreground">
          <span className="tabular-nums">{entries.length}</span>
          {' '}
          {updateLabel}
        </span>
      </div>

      <div className="relative w-full max-w-full min-w-0 overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-background">
              <th className={cn(tableHeaderClass, 'text-left whitespace-nowrap')}>{t('When')}</th>
              <th className={cn(tableHeaderClass, 'text-left whitespace-nowrap')}>{t('Market')}</th>
              <th className={cn(tableHeaderClass, 'text-left whitespace-nowrap')}>{t('Field')}</th>
              <th className={cn(tableHeaderClass, 'text-left whitespace-nowrap')}>{t('From')}</th>
              <th className={cn(tableHeaderClass, 'text-left whitespace-nowrap')}>{t('To')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ entry, field, isFirst, rowSpan }) => {
              const market = marketLookup.get(entry.condition_id)
              const marketLabel = formatConditionLabel(entry.condition_id, market)
              const oldValue = formatChangeValue(entry.old_values?.[field])
              const newValue = formatChangeValue(entry.new_values?.[field])

              return (
                <tr
                  key={`${entry.condition_id}-${entry.created_at}-${field}`}
                  className="align-top text-muted-foreground"
                >
                  {isFirst && (
                    <td className="px-2 py-3 sm:px-3" rowSpan={rowSpan}>
                      <div className="whitespace-nowrap text-foreground">
                        {formatTimestamp(entry.created_at, t('—'))}
                      </div>
                    </td>
                  )}
                  {isFirst && (
                    <td className="px-2 py-3 sm:px-3" rowSpan={rowSpan}>
                      <div className="wrap-break-word text-foreground">
                        {marketLabel}
                      </div>
                      <div className="mt-1 font-mono text-2xs tracking-wide break-all text-muted-foreground uppercase">
                        {entry.condition_id}
                      </div>
                    </td>
                  )}
                  <td className={`
                    px-2 py-3 font-mono text-xs tracking-wide whitespace-nowrap text-foreground uppercase
                    sm:px-3
                  `}
                  >
                    {field}
                  </td>
                  <td className="px-2 py-3 font-mono text-xs whitespace-nowrap sm:px-3">
                    {oldValue}
                  </td>
                  <td className="px-2 py-3 font-mono text-xs whitespace-nowrap text-foreground sm:px-3">
                    {newValue}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
