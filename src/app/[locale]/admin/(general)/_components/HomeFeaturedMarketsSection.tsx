'use client'

import type { IconName } from 'lucide-react/dynamic'
import type { Dispatch, SetStateAction } from 'react'
import type {
  HomeFeaturedContextItem,
  HomeFeaturedContextMode,
  HomeFeaturedEventAdminItem,
  HomeFeaturedSideCardSettings,
} from '@/types'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  NewspaperIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useExtracted } from 'next-intl'
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
import { serializeHomeFeaturedEventsForSave } from '@/lib/home-featured-payload'
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
  locale: string
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
  commentBlacklist: string
  onCommentBlacklistChange: (value: string) => void
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

function fetchAdminEventsApi(pathname: string, init?: RequestInit) {
  return fetch(`/admin/api/events${pathname}`, init)
}

function formatSideCardIconLabel(icon: string) {
  return icon
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
    contextItems: [],
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

function normalizePreviewImageSrc(src: string | null | undefined) {
  const normalizedSrc = src?.trim()
  if (!normalizedSrc) {
    return null
  }
  if (normalizedSrc.startsWith('/') && !normalizedSrc.startsWith('//')) {
    return normalizedSrc
  }
  if (normalizedSrc.startsWith('data:image/') || normalizedSrc.startsWith('blob:')) {
    return normalizedSrc
  }

  try {
    const url = new URL(normalizedSrc.startsWith('//') ? `https:${normalizedSrc}` : normalizedSrc)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  }
  catch {
    return null
  }
}

function AdminPreviewImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className: string
}) {
  const normalizedSrc = normalizePreviewImageSrc(src)
  if (!normalizedSrc) {
    return null
  }

  return (
    // eslint-disable-next-line next/no-img-element
    <img
      src={normalizedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
    />
  )
}

function buildManualNewsContextItem(item: {
  title: string
  source: string
  url: string
  faviconUrl: string | null
  publishedAt: string | null
}): HomeFeaturedContextItem {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  return {
    id: `manual-news:${item.url}`,
    type: 'news',
    source: item.source,
    title: item.title,
    avatarUrl: null,
    faviconUrl: item.faviconUrl,
    url: item.url,
    publishedAt: item.publishedAt,
    selectedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    relevanceScore: 1,
    isManual: true,
  }
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
  const [loadingRequestId, setLoadingRequestId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<AdminEventCandidate[]>([])
  const searchRequestIdRef = useRef(0)
  const isLoading = loadingRequestId === searchRequestIdRef.current
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
      setLoadingRequestId(requestId)

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
          setLoadingRequestId(null)
        }
      }
    }, 200)

    return function cleanupCandidateLoad() {
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [open, search, t])

  function handleOpenChange(nextOpen: boolean) {
    searchRequestIdRef.current += 1
    setLoadingRequestId(null)
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                    <AdminPreviewImage src={candidate.icon_url} alt="" className="size-10 object-cover" />
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
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            {t('Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HomeFeaturedSettingsDialog({
  open,
  disabled,
  useAi,
  maxCards,
  defaultContextMode,
  newsSources,
  commentBlacklist,
  minVolume24h,
  includeSportsToday,
  includeNewEvents,
  onOpenChange,
  onMaxCardsChange,
  onDefaultContextModeChange,
  onNewsSourcesChange,
  onCommentBlacklistChange,
  onMinVolume24hChange,
  onIncludeSportsTodayChange,
  onIncludeNewEventsChange,
}: {
  open: boolean
  disabled: boolean
  useAi: boolean
  maxCards: number
  defaultContextMode: HomeFeaturedContextMode
  newsSources: string
  commentBlacklist: string
  minVolume24h: number
  includeSportsToday: boolean
  includeNewEvents: boolean
  onOpenChange: (open: boolean) => void
  onMaxCardsChange: (value: number) => void
  onDefaultContextModeChange: (value: HomeFeaturedContextMode) => void
  onNewsSourcesChange: (value: string) => void
  onCommentBlacklistChange: (value: string) => void
  onMinVolume24hChange: (value: number) => void
  onIncludeSportsTodayChange: (value: boolean) => void
  onIncludeNewEventsChange: (value: boolean) => void
}) {
  const t = useExtracted()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Selection and context settings')}</DialogTitle>
          <DialogDescription>
            {t('Manual order is respected first. AI picks can fill empty slots when enabled.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <Label>{t('Automatic filters')}</Label>
            <div className="grid gap-3 sm:grid-cols-2">
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

          {useAi && (
            <div className="grid gap-2">
              <Label htmlFor="home-featured-news-sources">{t('News sources')}</Label>
              <Textarea
                id="home-featured-news-sources"
                value={newsSources}
                onChange={event => onNewsSourcesChange(event.target.value)}
                placeholder={t('One RSS feed, news URL, sitemap, or allowed domain per line')}
                disabled={disabled}
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">
                {t('AI uses these as publication hints, then searches for recent news about each featured market.')}
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="home-featured-comment-blacklist">{t('Comment blacklist')}</Label>
            <Textarea
              id="home-featured-comment-blacklist"
              value={commentBlacklist}
              onChange={event => onCommentBlacklistChange(event.target.value)}
              placeholder="www&#10;.com&#10;spam"
              disabled={disabled}
              className="min-h-28"
            />
            <p className="text-xs text-muted-foreground">
              {t('One word or fragment per line. Comments containing any fragment will not appear on the home card.')}
            </p>
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Side card')}</DialogTitle>
          <DialogDescription>
            {t('Configure the compact card shown above Hot topics in the featured markets rail.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2 rounded-lg border p-2">
              {HOME_FEATURED_SIDE_CARD_ICONS.map((icon) => {
                const selected = sideCard.icon === icon
                const label = formatSideCardIconLabel(icon)

                return (
                  <button
                    key={icon}
                    type="button"
                    aria-label={label}
                    aria-pressed={selected}
                    title={label}
                    disabled={disabled}
                    onClick={() => updateSideCard({ icon })}
                    className={cn(
                      `
                        flex h-9 min-w-0 items-center justify-center rounded-md border text-muted-foreground
                        transition-colors
                        hover:border-border hover:bg-secondary hover:text-foreground
                        focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none
                        disabled:cursor-not-allowed disabled:opacity-50
                      `,
                      selected && `
                        border-primary/50 bg-primary/10 text-primary
                        hover:border-primary/50 hover:bg-primary/10 hover:text-primary
                      `,
                    )}
                  >
                    <DynamicIcon name={icon as IconName} className="size-4" />
                  </button>
                )
              })}
            </div>
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

function HomeFeaturedContextDialog({
  open,
  disabled,
  item,
  newsSources,
  onOpenChange,
  onSave,
}: {
  open: boolean
  disabled: boolean
  item: HomeFeaturedEventAdminItem | null
  newsSources: string
  onOpenChange: (open: boolean) => void
  onSave: (updates: Pick<HomeFeaturedEventAdminItem, 'contextItems'>) => void
}) {
  const t = useExtracted()
  const [newsUrl, setNewsUrl] = useState('')
  const [contextItemsDraft, setContextItemsDraft] = useState<HomeFeaturedContextItem[]>(() => item?.contextItems ?? [])
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [isFindingNews, setIsFindingNews] = useState(false)
  const canManageNews = item?.contextMode === 'news' || item?.contextMode === 'auto'

  function addContextItems(items: HomeFeaturedContextItem[]) {
    setContextItemsDraft((previous) => {
      const seen = new Set(previous.map(contextItem => contextItem.url ?? contextItem.title))
      const next = [...previous]
      for (const contextItem of items) {
        const key = contextItem.url ?? contextItem.title
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        next.push(contextItem)
      }

      return next.slice(0, 3)
    })
  }

  async function addUrl() {
    const trimmedUrl = newsUrl.trim()
    if (!trimmedUrl) {
      return
    }

    try {
      setIsFetchingUrl(true)
      const response = await fetch('/admin/api/home-featured-events/context-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      })
      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !payload || typeof payload !== 'object') {
        throw new Error(apiError || t('Could not fetch URL metadata.'))
      }

      const metadata = (payload as { item?: unknown }).item
      if (!metadata || typeof metadata !== 'object') {
        throw new Error(t('Could not fetch URL metadata.'))
      }

      addContextItems([buildManualNewsContextItem(metadata as Parameters<typeof buildManualNewsContextItem>[0])])
      setNewsUrl('')
    }
    catch (error) {
      console.error('Failed to add featured context URL', error)
      toast.error(error instanceof Error ? error.message : t('Could not fetch URL metadata.'))
    }
    finally {
      setIsFetchingUrl(false)
    }
  }

  async function findNewsWithAi() {
    if (!item) {
      return
    }

    try {
      setIsFindingNews(true)
      const response = await fetch('/admin/api/home-featured-events/context-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          slug: item.slug,
          newsSources,
        }),
      })
      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !payload || typeof payload !== 'object') {
        throw new Error(apiError || t('Could not find news for this featured market.'))
      }

      const rows = (payload as { items?: unknown }).items
      const items = Array.isArray(rows)
        ? rows.map(row => buildManualNewsContextItem(row as Parameters<typeof buildManualNewsContextItem>[0]))
        : []
      if (items.length === 0) {
        toast.message(t('No news suggestions found.'))
        return
      }

      addContextItems(items)
      toast.success(t('News suggestions added.'))
    }
    catch (error) {
      console.error('Failed to find featured context news', error)
      toast.error(error instanceof Error ? error.message : t('Could not find news for this featured market.'))
    }
    finally {
      setIsFindingNews(false)
    }
  }

  function saveAndClose() {
    onSave({
      contextItems: contextItemsDraft,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Manage context')}</DialogTitle>
          <DialogDescription>
            {item?.title ?? t('Featured market')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {canManageNews && (
            <div className="grid gap-3">
              <div>
                <Label>{t('News shown on home')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('Add article URLs manually or ask AI to find recent news from the configured source hints.')}
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  value={newsUrl}
                  onChange={event => setNewsUrl(event.target.value)}
                  placeholder="https://news-site.com/article"
                  disabled={disabled || isFetchingUrl}
                />
                <Button type="button" variant="secondary" onClick={addUrl} disabled={disabled || isFetchingUrl || !newsUrl.trim()}>
                  {isFetchingUrl ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                  {t('Add URL')}
                </Button>
              </div>

              <Button type="button" variant="outline" className="w-fit" onClick={findNewsWithAi} disabled={disabled || isFindingNews}>
                {isFindingNews ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                {t('Find news with AI')}
              </Button>

              <div className="grid gap-2">
                {contextItemsDraft.length === 0
                  ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        {t('No manual news selected yet.')}
                      </div>
                    )
                  : contextItemsDraft.map((contextItem, index) => (
                      <div
                        key={`${contextItem.url ?? contextItem.id}:${index}`}
                        className="
                          grid gap-3 rounded-lg border p-3
                          sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center
                        "
                      >
                        <div className="size-8 overflow-hidden rounded-md bg-muted">
                          <AdminPreviewImage src={contextItem.faviconUrl} alt="" className="size-8 object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{contextItem.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[contextItem.source, contextItem.url].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled}
                          onClick={() => setContextItemsDraft(previous => previous.filter((_, itemIndex) => itemIndex !== index))}
                          aria-label={t('Remove')}
                        >
                          <XIcon className="size-4" />
                        </Button>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button type="button" onClick={saveAndClose} disabled={disabled}>
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
  onManageContext,
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
  onManageContext: (index: number) => void
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
        <AdminPreviewImage src={item.iconUrl} alt="" className="size-10 object-cover" />
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
          disabled={disabled || item.contextMode === 'hidden' || item.contextMode === 'comments'}
          onClick={() => onManageContext(index)}
          aria-label={t('Manage context')}
        >
          <NewspaperIcon className="size-4" />
        </Button>
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
  locale,
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
  commentBlacklist,
  onCommentBlacklistChange,
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
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [sideCardDialogOpen, setSideCardDialogOpen] = useState(false)
  const [manageContextIndex, setManageContextIndex] = useState<number | null>(null)
  const [isRegenerating, startRegenerating] = useTransition()
  const disabled = isPending || isRegenerating
  const manageContextItem = manageContextIndex == null ? null : featuredEvents[manageContextIndex] ?? null

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
              commentBlacklist,
              minVolume24h,
              includeSportsToday,
              includeNewEvents,
              sideCard,
            },
            featuredEvents: serializeHomeFeaturedEventsForSave(featuredEvents, locale),
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

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="
                flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground
              "
              >
                <SlidersHorizontalIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('Selection and context settings')}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {`${t('Max cards')}: ${maxCards} · ${t('Default context')}: ${defaultContextMode} · ${t('Minimum 24h volume')}: ${formatDollarValueLabel(minVolume24h, { maximumFractionDigits: 0 })}`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSettingsDialogOpen(true)}
              disabled={disabled}
              aria-label={t('Selection and context settings')}
            >
              <SettingsIcon className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="
                flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground
              "
              >
                <DynamicIcon name={sideCard.icon as IconName} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('Side card')}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {sideCard.title || sideCard.text || (sideCard.useAi ? t('AI side card enabled') : t('Manual side card'))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sideCard.useAi ? t('AI side card enabled') : t('Manual side card')}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSideCardDialogOpen(true)}
              disabled={disabled}
              aria-label={t('Side card')}
            >
              <SettingsIcon className="size-4" />
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
                      onManageContext={setManageContextIndex}
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

      <HomeFeaturedSettingsDialog
        open={settingsDialogOpen}
        disabled={disabled}
        useAi={useAi}
        maxCards={maxCards}
        defaultContextMode={defaultContextMode}
        newsSources={newsSources}
        commentBlacklist={commentBlacklist}
        minVolume24h={minVolume24h}
        includeSportsToday={includeSportsToday}
        includeNewEvents={includeNewEvents}
        onOpenChange={setSettingsDialogOpen}
        onMaxCardsChange={onMaxCardsChange}
        onDefaultContextModeChange={onDefaultContextModeChange}
        onNewsSourcesChange={onNewsSourcesChange}
        onCommentBlacklistChange={onCommentBlacklistChange}
        onMinVolume24hChange={onMinVolume24hChange}
        onIncludeSportsTodayChange={onIncludeSportsTodayChange}
        onIncludeNewEventsChange={onIncludeNewEventsChange}
      />

      <HomeFeaturedSideCardDialog
        open={sideCardDialogOpen}
        disabled={disabled}
        sideCard={sideCard}
        onOpenChange={setSideCardDialogOpen}
        onSideCardChange={onSideCardChange}
      />

      <HomeFeaturedContextDialog
        key={manageContextItem
          ? `${buildFeaturedKey(manageContextItem)}:${manageContextItem.slug ?? ''}`
          : 'home-featured-context-dialog'}
        open={manageContextIndex != null}
        disabled={disabled}
        item={manageContextItem}
        newsSources={newsSources}
        onOpenChange={open => setManageContextIndex(open ? manageContextIndex : null)}
        onSave={updates => manageContextIndex != null && updateItem(manageContextIndex, current => ({
          ...current,
          contextItems: updates.contextItems,
        }))}
      />
    </SettingsAccordionSection>
  )
}
