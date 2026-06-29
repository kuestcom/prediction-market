'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { HomeFeaturedContextMode, HomeFeaturedEventAdminItem, HomeFeaturedSideCardSettings } from '@/types'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EditIcon,
  FlameIcon,
  LineChartIcon,
  Loader2Icon,
  NewspaperIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  StarsIcon,
  TrendingUpIcon,
  XIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatDollarValueLabel } from '@/lib/formatters'
import {
  HOME_FEATURED_SIDE_CARD_ICONS,
  HOME_FEATURED_SIDE_CARD_LIMITS,
} from '@/lib/home-featured-settings'
import { cn } from '@/lib/utils'
import SettingsAccordionSection from './SettingsAccordionSection'

interface AdminEventCandidate {
  id: string
  slug: string
  title: string
  icon_url: string | null
  series_slug: string | null
  series_recurrence: string | null
  volume: number
  volume_24h: number
  status: string
  end_date: string | null
  sports_score: string | null
  sports_live: boolean | null
  sports_ended: boolean | null
}

interface HomeFeaturedMarketsSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  useAi: boolean
  onUseAiChange: (value: boolean) => void
  maxCards: number
  onMaxCardsChange: (value: number) => void
  defaultContextMode: HomeFeaturedContextMode
  onDefaultContextModeChange: (value: HomeFeaturedContextMode) => void
  newsSources: string
  onNewsSourcesChange: (value: string) => void
  minVolume24h: number
  onMinVolume24hChange: (value: number) => void
  includeSportsToday: boolean
  onIncludeSportsTodayChange: (value: boolean) => void
  includeNewEvents: boolean
  onIncludeNewEventsChange: (value: boolean) => void
  sideCard: HomeFeaturedSideCardSettings
  onSideCardChange: Dispatch<SetStateAction<HomeFeaturedSideCardSettings>>
  featuredEvents: HomeFeaturedEventAdminItem[]
  onFeaturedEventsChange: Dispatch<SetStateAction<HomeFeaturedEventAdminItem[]>>
}

const SIDE_CARD_ICON_META = {
  'flame': {
    label: 'Flame',
    Icon: FlameIcon,
  },
  'line-chart': {
    label: 'Line chart',
    Icon: LineChartIcon,
  },
  'newspaper': {
    label: 'News',
    Icon: NewspaperIcon,
  },
  'sparkles': {
    label: 'Sparkles',
    Icon: SparklesIcon,
  },
  'stars': {
    label: 'Stars',
    Icon: StarsIcon,
  },
  'trending-up': {
    label: 'Trending up',
    Icon: TrendingUpIcon,
  },
} as const

function fetchAdminEventsApi(pathname: string, init?: RequestInit) {
  return fetch(`/admin/api/events${pathname}`, init)
}

function readApiError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.trim() ? maybeError.trim() : null
}

function buildFeaturedKey(item: Pick<HomeFeaturedEventAdminItem, 'eventId' | 'seriesSlug' | 'targetType'>) {
  return item.targetType === 'series'
    ? `series:${item.seriesSlug ?? ''}`
    : `event:${item.eventId ?? ''}`
}

function toFeaturedItem(candidate: AdminEventCandidate, rank: number): HomeFeaturedEventAdminItem {
  const hasSeries = Boolean(candidate.series_slug?.trim())

  return {
    targetType: hasSeries ? 'series' : 'event',
    eventId: candidate.id,
    seriesSlug: hasSeries ? candidate.series_slug : null,
    title: candidate.title,
    slug: candidate.slug,
    iconUrl: candidate.icon_url,
    enabled: true,
    rank,
    source: 'manual',
    startsAt: null,
    endsAt: null,
    contextMode: 'auto',
    autoRolloverEnabled: hasSeries,
  }
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items
  }

  const next = [...items]
  const current = next[index]
  const target = next[nextIndex]
  if (current === undefined || target === undefined) {
    return items
  }

  next[index] = target
  next[nextIndex] = current
  return next
}

function serializeFeaturedEventsForSave(items: HomeFeaturedEventAdminItem[]) {
  return items.map((event, index) => ({
    targetType: event.targetType,
    eventId: event.eventId,
    seriesSlug: event.seriesSlug,
    enabled: event.enabled,
    rank: index,
    source: event.source,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    contextMode: event.contextMode,
    autoRolloverEnabled: event.autoRolloverEnabled,
  }))
}

function HomeFeaturedSelectionDialog({
  open,
  disabled,
  selectedItems,
  onOpenChange,
  onAddCandidate,
}: {
  open: boolean
  disabled: boolean
  selectedItems: HomeFeaturedEventAdminItem[]
  onOpenChange: (open: boolean) => void
  onAddCandidate: (candidate: AdminEventCandidate) => void
}) {
  const t = useExtracted()
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [candidates, setCandidates] = useState<AdminEventCandidate[]>([])
  const searchRequestIdRef = useRef(0)
  const selectedKeys = useMemo(
    () => new Set(selectedItems.map(buildFeaturedKey)),
    [selectedItems],
  )

  useEffect(function loadCandidates() {
    if (!open) {
      searchRequestIdRef.current += 1
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    const controller = new AbortController()
    const timeoutId = setTimeout(async () => {
      setIsLoading(true)

      try {
        const params = new URLSearchParams({
          activeOnly: '1',
          limit: '30',
          sortBy: 'volume_24h',
          sortOrder: 'desc',
        })
        if (search.trim()) {
          params.set('search', search.trim())
        }

        const response = await fetchAdminEventsApi(`?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null) as unknown
        const apiError = readApiError(payload)

        if (!response.ok || apiError || !payload || typeof payload !== 'object') {
          throw new Error(apiError || t('Could not load events.'))
        }

        const rows = (payload as { data?: unknown }).data
        if (searchRequestIdRef.current === requestId) {
          setCandidates(Array.isArray(rows) ? rows as AdminEventCandidate[] : [])
        }
      }
      catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          return
        }

        console.error('Failed to load featured market candidates', error)
        toast.error(error instanceof Error ? error.message : t('Could not load events.'))
      }
      finally {
        if (searchRequestIdRef.current === requestId) {
          setIsLoading(false)
        }
      }
    }, 200)

    return function cleanupCandidateLoad() {
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [open, search, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('Add featured markets')}</DialogTitle>
          <DialogDescription>
            {t('Select active markets for the home carousel. Recurring markets are saved as a series automatically.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('Search active markets')}
              className="pl-9"
              disabled={disabled}
            />
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border">
            {isLoading && (
              <div className="flex h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                {t('Searching events...')}
              </div>
            )}

            {!isLoading && candidates.length === 0 && (
              <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                {t('No events found')}
              </div>
            )}

            {!isLoading && candidates.map((candidate) => {
              const candidateKey = buildFeaturedKey(toFeaturedItem(candidate, selectedItems.length))
              const isSelected = selectedKeys.has(candidateKey)

              return (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={disabled || isSelected}
                  onClick={() => onAddCandidate(candidate)}
                  className={cn(`
                    flex w-full items-center gap-3 border-b p-3 text-left
                    last:border-b-0
                    hover:bg-muted/50
                    disabled:cursor-not-allowed disabled:opacity-60
                  `)}
                >
                  <div className="size-10 overflow-hidden rounded-lg bg-muted">
                    {candidate.icon_url && (
                      <Image
                        src={candidate.icon_url}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{candidate.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {candidate.series_slug ? `${t('Series')} · ${candidate.series_slug}` : candidate.slug}
                    </p>
                  </div>
                  <div className="hidden text-right text-sm text-muted-foreground sm:block">
                    <p>{formatDollarValueLabel(candidate.volume, { maximumFractionDigits: 0 })}</p>
                    <p>{`${formatDollarValueLabel(candidate.volume_24h, { maximumFractionDigits: 0 })} 24h`}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {isSelected ? t('Added') : t('Add')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HomeFeaturedSideCardDialog({
  open,
  disabled,
  sideCard,
  onOpenChange,
  onSideCardChange,
}: {
  open: boolean
  disabled: boolean
  sideCard: HomeFeaturedSideCardSettings
  onOpenChange: (open: boolean) => void
  onSideCardChange: Dispatch<SetStateAction<HomeFeaturedSideCardSettings>>
}) {
  const t = useExtracted()

  function updateSideCard(updates: Partial<HomeFeaturedSideCardSettings>) {
    onSideCardChange(previous => ({
      ...previous,
      ...updates,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Edit side card')}</DialogTitle>
          <DialogDescription>
            {t('Configure the compact card shown above Hot topics in the featured markets rail.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="home-featured-side-title">{t('Title')}</Label>
            <Input
              id="home-featured-side-title"
              value={sideCard.title}
              onChange={event => updateSideCard({ title: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.title) })}
              maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.title}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="home-featured-side-text">{t('Text')}</Label>
            <Textarea
              id="home-featured-side-text"
              value={sideCard.text}
              onChange={event => updateSideCard({ text: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.text) })}
              maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.text}
              disabled={disabled}
              className="min-h-24"
            />
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="grid gap-1">
              <span className="text-sm font-medium">{t('Generate side card with AI')}</span>
              <span className="text-sm text-muted-foreground">
                {t('Use topics and featured markets to fill this card automatically.')}
              </span>
            </span>
            <Switch
              checked={sideCard.useAi}
              onCheckedChange={checked => updateSideCard({ useAi: checked })}
              disabled={disabled}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="home-featured-side-cta-label">{t('CTA label')}</Label>
              <Input
                id="home-featured-side-cta-label"
                value={sideCard.ctaLabel}
                onChange={event => updateSideCard({ ctaLabel: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.ctaLabel) })}
                maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.ctaLabel}
                disabled={disabled}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="home-featured-side-cta-link">{t('CTA link')}</Label>
              <Input
                id="home-featured-side-cta-link"
                value={sideCard.ctaHref}
                onChange={event => updateSideCard({ ctaHref: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.ctaHref) })}
                maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.ctaHref}
                placeholder="/trending"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t('Icon')}</Label>
            <Select
              value={sideCard.icon}
              onValueChange={value => updateSideCard({ icon: value as HomeFeaturedSideCardSettings['icon'] })}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOME_FEATURED_SIDE_CARD_ICONS.map((icon) => {
                  const meta = SIDE_CARD_ICON_META[icon]
                  const Icon = meta.Icon

                  return (
                    <SelectItem key={icon} value={icon}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="size-4" />
                        {meta.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FeaturedEventRow({
  item,
  index,
  disabled,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onContextModeChange,
  onEnabledChange,
}: {
  item: HomeFeaturedEventAdminItem
  index: number
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
  onContextModeChange: (index: number, mode: HomeFeaturedContextMode) => void
  onEnabledChange: (index: number, enabled: boolean) => void
}) {
  const t = useExtracted()

  return (
    <div className="
      grid min-w-0 gap-3 rounded-lg border p-3
      md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:items-center
    "
    >
      <div className="size-10 overflow-hidden rounded-lg bg-muted">
        {item.iconUrl && (
          <Image
            src={item.iconUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 object-cover"
          />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {item.targetType === 'series' ? `${t('Series')} · ${item.seriesSlug}` : item.slug}
        </p>
      </div>

      <Select
        value={item.contextMode}
        onValueChange={value => onContextModeChange(index, value as HomeFeaturedContextMode)}
        disabled={disabled}
      >
        <SelectTrigger className="hidden w-32 sm:flex">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">{t('Auto')}</SelectItem>
          <SelectItem value="news">{t('News')}</SelectItem>
          <SelectItem value="comments">{t('Comments')}</SelectItem>
          <SelectItem value="hidden">{t('Hidden')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center justify-between gap-3 md:block">
        <Select
          value={item.contextMode}
          onValueChange={value => onContextModeChange(index, value as HomeFeaturedContextMode)}
          disabled={disabled}
        >
          <SelectTrigger className="w-32 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t('Auto')}</SelectItem>
            <SelectItem value="news">{t('News')}</SelectItem>
            <SelectItem value="comments">{t('Comments')}</SelectItem>
            <SelectItem value="hidden">{t('Hidden')}</SelectItem>
          </SelectContent>
        </Select>

        <Switch checked={item.enabled} onCheckedChange={checked => onEnabledChange(index, checked)} disabled={disabled} />
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isFirst}
          onClick={() => onMove(index, -1)}
          aria-label={t('Move up')}
        >
          <ArrowUpIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isLast}
          onClick={() => onMove(index, 1)}
          aria-label={t('Move down')}
        >
          <ArrowDownIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => onRemove(index)}
          aria-label={t('Remove')}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export default function HomeFeaturedMarketsSection({
  isPending,
  openSections,
  onToggleSection,
  enabled,
  onEnabledChange,
  useAi,
  onUseAiChange,
  maxCards,
  onMaxCardsChange,
  defaultContextMode,
  onDefaultContextModeChange,
  newsSources,
  onNewsSourcesChange,
  minVolume24h,
  onMinVolume24hChange,
  includeSportsToday,
  onIncludeSportsTodayChange,
  includeNewEvents,
  onIncludeNewEventsChange,
  sideCard,
  onSideCardChange,
  featuredEvents,
  onFeaturedEventsChange,
}: HomeFeaturedMarketsSectionProps) {
  const t = useExtracted()
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false)
  const [sideCardDialogOpen, setSideCardDialogOpen] = useState(false)
  const [isRegenerating, startRegenerating] = useTransition()
  const disabled = isPending || isRegenerating
  const SideCardPreviewIcon = SIDE_CARD_ICON_META[sideCard.icon]?.Icon ?? TrendingUpIcon

  function addCandidate(candidate: AdminEventCandidate) {
    onFeaturedEventsChange((previous) => {
      const item = toFeaturedItem(candidate, previous.length)
      const key = buildFeaturedKey(item)
      if (previous.some(current => buildFeaturedKey(current) === key)) {
        return previous
      }

      return [...previous, item].slice(0, 8)
    })
  }

  function updateItem(index: number, updater: (item: HomeFeaturedEventAdminItem) => HomeFeaturedEventAdminItem) {
    onFeaturedEventsChange(previous => previous.map((item, currentIndex) => (
      currentIndex === index ? updater(item) : item
    )))
  }

  function regenerateFeaturedMarkets() {
    startRegenerating(async () => {
      try {
        const response = await fetch('/admin/api/home-featured-events/regenerate', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settings: {
              enabled,
              useAi,
              maxCards,
              defaultContextMode,
              newsSources,
              minVolume24h,
              includeSportsToday,
              includeNewEvents,
              sideCard,
            },
            featuredEvents: serializeFeaturedEventsForSave(featuredEvents),
          }),
        })
        const payload = await response.json().catch(() => null) as unknown
        const apiError = readApiError(payload)

        if (!response.ok || apiError || !payload || typeof payload !== 'object') {
          throw new Error(apiError || t('Could not regenerate featured markets.'))
        }

        const items = (payload as { items?: unknown }).items
        if (Array.isArray(items)) {
          onFeaturedEventsChange(items as HomeFeaturedEventAdminItem[])
        }

        toast.success(t('Featured markets regenerated.'))
      }
      catch (error) {
        console.error('Failed to regenerate featured markets', error)
        toast.error(error instanceof Error ? error.message : t('Could not regenerate featured markets.'))
      }
    })
  }

  return (
    <SettingsAccordionSection
      value="home-featured-markets"
      isOpen={openSections.includes('home-featured-markets')}
      onToggle={onToggleSection}
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <StarIcon className="size-4 text-muted-foreground" />
          {t('Featured markets')}
        </h3>
      )}
    >
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="grid gap-1">
              <span className="text-sm font-medium">{t('Enable featured markets on home')}</span>
              <span className="text-sm text-muted-foreground">{t('Show the carousel below the main navigation.')}</span>
            </span>
            <Switch checked={enabled} onCheckedChange={onEnabledChange} disabled={disabled} />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span className="grid gap-1">
              <span className="text-sm font-medium">{t('Use AI to highlight markets')}</span>
              <span className="text-sm text-muted-foreground">{t('Keep manual picks and let AI complete the remaining slots.')}</span>
            </span>
            <Switch checked={useAi} onCheckedChange={onUseAiChange} disabled={disabled} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="home-featured-max-cards">{t('Max cards')}</Label>
            <Input
              id="home-featured-max-cards"
              type="number"
              min={1}
              max={8}
              value={maxCards}
              onChange={event => onMaxCardsChange(Math.min(8, Math.max(1, Number(event.target.value) || 1)))}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t('Default context')}</Label>
            <Select
              value={defaultContextMode}
              onValueChange={value => onDefaultContextModeChange(value as HomeFeaturedContextMode)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('Auto')}</SelectItem>
                <SelectItem value="news">{t('News')}</SelectItem>
                <SelectItem value="comments">{t('Comments')}</SelectItem>
                <SelectItem value="hidden">{t('Hidden')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="home-featured-min-volume">{t('Minimum 24h volume')}</Label>
            <Input
              id="home-featured-min-volume"
              type="number"
              min={0}
              value={minVolume24h}
              onChange={event => onMinVolume24hChange(Math.max(0, Number(event.target.value) || 0))}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t('Automatic filters')}</Label>
            <div className="grid gap-2 rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                {t('Sports live/today')}
                <Switch checked={includeSportsToday} onCheckedChange={onIncludeSportsTodayChange} disabled={disabled} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                {t('New events')}
                <Switch checked={includeNewEvents} onCheckedChange={onIncludeNewEventsChange} disabled={disabled} />
              </label>
            </div>
          </div>
        </div>

        {useAi && (
          <div className="grid gap-2">
            <Label htmlFor="home-featured-news-sources">{t('News sources')}</Label>
            <Textarea
              id="home-featured-news-sources"
              value={newsSources}
              onChange={event => onNewsSourcesChange(event.target.value)}
              placeholder={t('One RSS feed, news URL, sitemap, or allowed domain per line')}
              disabled={disabled}
              className="min-h-24"
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label>{t('Side card')}</Label>
          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="
                flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground
              "
              >
                <SideCardPreviewIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{sideCard.title}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{sideCard.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sideCard.useAi ? t('AI generation enabled') : t('Manual content')}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSideCardDialogOpen(true)}
              disabled={disabled}
            >
              <EditIcon className="size-4" />
              {t('Edit side card')}
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label>{t('Featured markets')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('Manual order is respected first. AI picks can fill empty slots when enabled.')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectionDialogOpen(true)}
                disabled={disabled || featuredEvents.length >= 8}
              >
                <PlusIcon className="size-4" />
                {t('Add market')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={regenerateFeaturedMarkets}
                disabled={disabled || !useAi}
              >
                {isRegenerating ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                {t('Regenerate')}
              </Button>
            </div>
          </div>

          {featuredEvents.length === 0
            ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t('No featured markets selected yet.')}
                </div>
              )
            : (
                <div className="grid gap-2">
                  {featuredEvents.map((item, index) => (
                    <FeaturedEventRow
                      key={`${buildFeaturedKey(item)}:${index}`}
                      item={item}
                      index={index}
                      disabled={disabled}
                      isFirst={index === 0}
                      isLast={index === featuredEvents.length - 1}
                      onMove={(targetIndex, direction) => onFeaturedEventsChange(previous => moveItem(previous, targetIndex, direction))}
                      onRemove={targetIndex => onFeaturedEventsChange(previous => previous.filter((_, currentIndex) => currentIndex !== targetIndex))}
                      onContextModeChange={(targetIndex, mode) => updateItem(targetIndex, current => ({ ...current, contextMode: mode }))}
                      onEnabledChange={(targetIndex, nextEnabled) => updateItem(targetIndex, current => ({ ...current, enabled: nextEnabled }))}
                    />
                  ))}
                </div>
              )}
        </div>
      </div>

      <HomeFeaturedSelectionDialog
        open={selectionDialogOpen}
        disabled={disabled}
        selectedItems={featuredEvents}
        onOpenChange={setSelectionDialogOpen}
        onAddCandidate={addCandidate}
      />

      <HomeFeaturedSideCardDialog
        open={sideCardDialogOpen}
        disabled={disabled}
        sideCard={sideCard}
        onOpenChange={setSideCardDialogOpen}
        onSideCardChange={onSideCardChange}
      />
    </SettingsAccordionSection>
  )
}
