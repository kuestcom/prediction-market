'use client'

import type { Market } from '@/types'
import { CalendarIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn } from '@/lib/utils'

type Frequency = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly'

interface EventChartExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventCreatedAt: string
  markets: Market[]
  isMultiMarket: boolean
}

const frequencyOptions: Array<{ value: Frequency, label: string }> = [
  { value: 'minutely', label: 'Minutely' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const defaultFrequency: Frequency = 'daily'

const FREQUENCY_FIDELITY_MINUTES: Record<Frequency, number> = {
  minutely: 1,
  hourly: 60,
  daily: 1440,
  weekly: 10080,
  monthly: 43200,
}

interface PriceHistoryPoint {
  t: number
  p: number
}

interface PriceHistoryResponse {
  history?: PriceHistoryPoint[]
}

interface MarketTarget {
  conditionId: string
  tokenId: string
  label: string
}

function formatShortDate(value: Date, locale: string) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '--/--/----'
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value)
}

function formatFilenameDate(value: Date, locale: string) {
  return formatShortDate(value, locale).replace(/\D+/g, '-')
}

function formatUtcDateTime(value: Date) {
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${value.getUTCDate()}`.padStart(2, '0')
  const year = value.getUTCFullYear()
  const hours = `${value.getUTCHours()}`.padStart(2, '0')
  const minutes = `${value.getUTCMinutes()}`.padStart(2, '0')
  return `${month}-${day}-${year} ${hours}:${minutes}`
}

function getDefaultFromDate(frequency: Frequency, eventStart: Date, today: Date) {
  if (frequency === 'minutely') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  }
  return eventStart
}

function clampPrice(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

function slugifySiteName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'market'
}

function sanitizeTsvValue(value: string) {
  const sanitized = value.replace(/[\t\r\n]+/g, ' ').trim()
  if (!sanitized) {
    return sanitized
  }
  return /^[=+\-@]/.test(sanitized) ? `'${sanitized}` : sanitized
}

function buildMarketTarget(market: Market): MarketTarget | null {
  const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
    ?? market.outcomes[0]
  if (!yesOutcome?.token_id) {
    return null
  }
  return {
    conditionId: market.condition_id,
    tokenId: String(yesOutcome.token_id),
    label: sanitizeTsvValue(market.short_title ?? ''),
  }
}

async function fetchTokenPriceHistory(
  tokenId: string,
  filters: Record<string, string>,
): Promise<PriceHistoryPoint[]> {
  const url = new URL(`${process.env.CLOB_URL!}/prices-history`)
  url.searchParams.set('market', tokenId)
  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error('Failed to fetch price history')
  }

  const payload = await response.json() as PriceHistoryResponse
  return (payload.history ?? [])
    .map(point => ({ t: Number(point.t), p: Number(point.p) }))
    .filter(point => Number.isFinite(point.t) && Number.isFinite(point.p))
}

function buildCsvContent(
  historyByMarket: Record<string, PriceHistoryPoint[]>,
  targets: MarketTarget[],
  isMultiMarket: boolean,
) {
  const timeline = new Map<number, Map<string, number>>()
  Object.entries(historyByMarket).forEach(([conditionId, history]) => {
    history.forEach((point) => {
      const timestampSec = Math.floor(point.t)
      if (!timeline.has(timestampSec)) {
        timeline.set(timestampSec, new Map())
      }
      timeline.get(timestampSec)!.set(conditionId, clampPrice(point.p))
    })
  })

  const sortedTimestamps = Array.from(timeline.keys()).sort((a, b) => a - b)
  const lastKnown = new Map<string, number>()
  const rows: string[][] = []

  sortedTimestamps.forEach((timestampSec) => {
    const updates = timeline.get(timestampSec)
    updates?.forEach((price, marketKey) => {
      lastKnown.set(marketKey, price)
    })

    if (!lastKnown.size) {
      return
    }

    const dateLabel = formatUtcDateTime(new Date(timestampSec * 1000))
    const row = [dateLabel, String(timestampSec)]
    if (isMultiMarket) {
      targets.forEach((target) => {
        const value = lastKnown.get(target.conditionId)
        row.push(value == null ? '-' : String(value))
      })
    }
    else {
      const value = lastKnown.get(targets[0]?.conditionId ?? '')
      row.push(value == null ? '-' : String(value))
    }
    rows.push(row)
  })

  const header = isMultiMarket
    ? ['Date (UTC)', 'Timestamp (UTC)', ...targets.map(target => target.label)]
    : ['Date (UTC)', 'Timestamp (UTC)', 'Price']

  return [header.join('\t'), ...rows.map(row => row.join('\t'))].join('\n')
}

export default function EventChartExportDialog({
  open,
  onOpenChange,
  eventCreatedAt,
  markets,
  isMultiMarket,
}: EventChartExportDialogProps) {
  const t = useExtracted()
  const optionsListId = useId()
  const eventStartDate = useMemo(() => new Date(eventCreatedAt), [eventCreatedAt])
  const [frequency, setFrequency] = useState<Frequency>(defaultFrequency)
  const [fromDate, setFromDate] = useState<Date>(() => getDefaultFromDate(
    defaultFrequency,
    eventStartDate,
    new Date(),
  ))
  const [toDate, setToDate] = useState<Date>(() => new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [locale, setLocale] = useState('en-US')

  useEffect(() => {
    if (!open) {
      return
    }
    const today = new Date()
    setToDate(today)
    setFrequency(defaultFrequency)
    setFromDate(getDefaultFromDate(defaultFrequency, eventStartDate, today))
    setSelectedOptions([])
    setCalendarOpen(false)
  }, [open, eventStartDate])

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return
    }
    if (navigator.language) {
      setLocale(navigator.language)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    setFromDate(getDefaultFromDate(frequency, eventStartDate, toDate))
  }, [frequency, open, eventStartDate, toDate])

  const optionItems = useMemo(
    () => markets.map(market => ({
      id: market.condition_id,
      label: market.short_title ?? '',
    })),
    [markets],
  )
  const localizedFrequencyOptions = useMemo(() => {
    const labels: Record<Frequency, string> = {
      minutely: t('Minutely'),
      hourly: t('Hourly'),
      daily: t('Daily'),
      weekly: t('Weekly'),
      monthly: t('Monthly'),
    }
    return frequencyOptions.map(option => ({
      ...option,
      label: labels[option.value],
    }))
  }, [t])
  const allOptionIds = useMemo(() => optionItems.map(item => item.id), [optionItems])
  const allSelected = optionItems.length > 0 && selectedOptions.length === optionItems.length

  async function handleDownload() {
    if (isDownloading) {
      return
    }
    setIsDownloading(true)

    try {
      const fromSeconds = Math.floor(fromDate.getTime() / 1000)
      const toSeconds = Math.floor(toDate.getTime() / 1000)
      const startTs = Math.min(fromSeconds, toSeconds)
      const endTs = Math.max(fromSeconds, toSeconds)
      const filters = {
        fidelity: String(FREQUENCY_FIDELITY_MINUTES[frequency]),
        startTs: String(startTs),
        endTs: String(endTs),
      }

      const marketById = new Map(markets.map(market => [market.condition_id, market]))
      const selectedSet = new Set(selectedOptions)
      const orderedMarketIds = isMultiMarket
        ? optionItems
            .filter(item => selectedOptions.length === 0 || selectedSet.has(item.id))
            .map(item => item.id)
        : (markets[0]?.condition_id ? [markets[0].condition_id] : [])
      const orderedMarkets = orderedMarketIds
        .map(id => marketById.get(id))
        .filter((market): market is Market => Boolean(market))
      const targets = orderedMarkets
        .map(market => buildMarketTarget(market))
        .filter((target): target is MarketTarget => Boolean(target))

      if (!targets.length) {
        return
      }

      const entries = await Promise.all(
        targets.map(async (target) => {
          try {
            const history = await fetchTokenPriceHistory(target.tokenId, filters)
            return [target.conditionId, history] as const
          }
          catch {
            return [target.conditionId, []] as const
          }
        }),
      )
      const historyByMarket = Object.fromEntries(entries)
      const csv = buildCsvContent(historyByMarket, targets, isMultiMarket)
      const siteName = slugifySiteName(process.env.NEXT_PUBLIC_SITE_NAME ?? '')
      const filename = `${siteName}-price-data-${formatFilenameDate(fromDate, locale)}-${formatFilenameDate(toDate, locale)}-${Date.now()}.csv`
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    }
    catch (error) {
      console.error(error)
    }
    finally {
      setIsDownloading(false)
    }
  }

  const dateButtonClass = cn(
    `
      flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1 text-sm
      text-foreground shadow-xs transition-[color,box-shadow] outline-none
      focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
      disabled:cursor-not-allowed disabled:opacity-50
    `,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl sm:p-8">
        <div className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">
              {t('Download Price History')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{t('From')}</Label>
              <DropdownMenu open={calendarOpen} onOpenChange={setCalendarOpen}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={dateButtonClass}>
                    <span>{formatShortDate(fromDate, locale)}</span>
                    <CalendarIcon className="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  collisionPadding={16}
                  portalled={false}
                  className="border border-border bg-background p-2 shadow-xl"
                >
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => {
                      if (!date) {
                        return
                      }
                      setFromDate(date)
                      setCalendarOpen(false)
                    }}
                    className="bg-transparent p-0"
                    classNames={{ root: 'w-full' }}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-muted-foreground">{t('Market start pre-filled')}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{t('To')}</Label>
              <button type="button" className={dateButtonClass} disabled>
                <span>{formatShortDate(toDate, locale)}</span>
                <CalendarIcon className="size-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">{t('Frequency')}</Label>
              <Select value={frequency} onValueChange={value => setFrequency(value as Frequency)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localizedFrequencyOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isMultiMarket
            ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t('Options')}</span>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={checked => setSelectedOptions(checked ? allOptionIds : [])}
                        className="size-5 rounded-sm dark:bg-transparent"
                      />
                      {t('Select All')}
                    </label>
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-background p-3">
                    <div className="flex flex-col gap-2">
                      {optionItems.map((option, index) => {
                        const optionId = `${optionsListId}-${index}`
                        const isChecked = selectedOptions.includes(option.id)
                        return (
                          <label
                            key={option.id}
                            htmlFor={optionId}
                            className="flex items-center gap-2 text-sm font-medium text-foreground"
                          >
                            <Checkbox
                              id={optionId}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setSelectedOptions((prev) => {
                                  if (checked) {
                                    if (prev.includes(option.id)) {
                                      return prev
                                    }
                                    return [...prev, option.id]
                                  }
                                  return prev.filter(item => item !== option.id)
                                })
                              }}
                              className="size-5 rounded-sm dark:bg-transparent"
                            />
                            <span className="truncate">{option.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            : null}

          <Button type="button" className="w-full" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? t('Downloading...') : t('Download (.csv)')}
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  )
}
