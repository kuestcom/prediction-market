'use client'

import type { EmbedCodeLine } from '@/lib/embed-code'
import type { EmbedTheme } from '@/lib/embed-widget'
import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'
import { maybeShowAffiliateToast } from '@/lib/affiliate-toast'
import {
  attributeLine,
  EmbedCodePreview,
  tagCloseLine,
  tagEndLine,
  tagOpenLine,
  tagSelfCloseLine,
  tagWithAttributeLine,
} from '@/lib/embed-code'
import {
  buildFeatureList,
  buildIframeCode,
  buildWebComponentCode,
  EMBED_SCRIPT_URL,
  normalizeEmbedBaseUrl,
  requireEmbedValue,
} from '@/lib/embed-widget'
import { slugifySiteName } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface AffiliateWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: {
    slug: string
    name: string
  }[]
}

interface WidgetMarket {
  id: string
  slug: string
  label: string
}

type EmbedType = 'iframe' | 'web-component'

function buildMarketLabel(market: Event['markets'][number]) {
  return market.short_title?.trim() || market.title || market.slug
}

function buildAffiliateIframeSrc(
  baseUrl: string,
  categorySlug: string,
  locale: string,
  theme: EmbedTheme,
  features: string[],
  affiliateCode?: string,
) {
  if (!categorySlug) {
    return ''
  }

  const params = new URLSearchParams({
    category: categorySlug,
    theme,
    rotate: 'true',
    locale,
  })

  if (features.length > 0) {
    params.set('features', features.join(','))
  }
  if (affiliateCode?.trim()) {
    params.set('r', affiliateCode.trim())
  }

  return `${baseUrl}/market.html?${params.toString()}`
}

function buildAffiliatePreviewSrc(
  categorySlug: string,
  locale: string,
  theme: EmbedTheme,
  features: string[],
  affiliateCode?: string,
) {
  if (!categorySlug) {
    return ''
  }

  const params = new URLSearchParams({
    category: categorySlug,
    theme,
    rotate: 'true',
    locale,
  })

  if (features.length > 0) {
    params.set('features', features.join(','))
  }
  if (affiliateCode?.trim()) {
    params.set('r', affiliateCode.trim())
  }

  return `/market.html?${params.toString()}`
}

async function fetchCategoryMarkets(tag: string, locale: string, signal: AbortSignal): Promise<WidgetMarket[]> {
  const params = new URLSearchParams({
    tag,
    status: 'active',
    offset: '0',
    locale,
  })

  const response = await fetch(`/api/events?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to fetch category events.')
  }

  const events = await response.json() as Event[]
  return events
    .flatMap(event => event.markets.map(market => ({
      id: `${event.id}:${market.condition_id}`,
      slug: market.slug,
      label: buildMarketLabel(market),
    })))
    .filter(market => Boolean(market.slug))
    .slice(0, 80)
}

const SITE_URL = normalizeEmbedBaseUrl(requireEmbedValue(process.env.SITE_URL, 'SITE_URL'))
const IFRAME_HEIGHT_WITH_CHART = 400
const IFRAME_HEIGHT_WITH_FILTERS = 440
const IFRAME_HEIGHT_NO_CHART = 180

function useEmbedOptions() {
  const [theme, setTheme] = useState<EmbedTheme>('light')
  const [embedType, setEmbedType] = useState<EmbedType>('iframe')
  const [showVolume, setShowVolume] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [showTimeRange, setShowTimeRange] = useState(false)

  function handleShowChartChange(nextValue: boolean) {
    setShowChart(nextValue)
    if (!nextValue) {
      setShowTimeRange(false)
    }
  }

  return {
    theme,
    setTheme,
    embedType,
    setEmbedType,
    showVolume,
    setShowVolume,
    showChart,
    showTimeRange,
    setShowTimeRange,
    handleShowChartChange,
  }
}

function useEmbedCategorySelection(categories: AffiliateWidgetDialogProps['categories']) {
  const [selectedCategoryState, setSelectedCategoryState] = useState<string>(categories[0]?.slug ?? '')
  const selectedCategory = useMemo(
    () => categories.some(category => category.slug === selectedCategoryState)
      ? selectedCategoryState
      : (categories[0]?.slug ?? ''),
    [categories, selectedCategoryState],
  )
  return { selectedCategory, setSelectedCategoryState }
}

function useCopyFlashState() {
  const [copied, setCopied] = useState(false)
  return { copied, setCopied }
}

function useSiteSlug(siteName: string) {
  return useMemo(() => {
    try {
      return slugifySiteName(siteName)
    }
    catch {
      return 'market'
    }
  }, [siteName])
}

function useAffiliateFeeSettings(affiliateCode: string) {
  const feeSettingsQuery = useQuery({
    queryKey: ['affiliate-widget-fee-settings', affiliateCode],
    enabled: Boolean(affiliateCode),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const result = await fetchAffiliateSettingsFromAPI()
        if (!result.success) {
          return { affiliateSharePercent: null, tradeFeePercent: null }
        }

        const shareParsed = Number.parseFloat(result.data.affiliateSharePercent)
        const feeParsed = Number.parseFloat(result.data.tradeFeePercent)

        return {
          affiliateSharePercent: Number.isFinite(shareParsed) && shareParsed > 0 ? shareParsed : null,
          tradeFeePercent: Number.isFinite(feeParsed) && feeParsed > 0 ? feeParsed : null,
        }
      }
      catch {
        return { affiliateSharePercent: null, tradeFeePercent: null }
      }
    },
  })

  if (!affiliateCode) {
    return { affiliateSharePercent: null, tradeFeePercent: null }
  }

  return feeSettingsQuery.data ?? { affiliateSharePercent: null, tradeFeePercent: null }
}

function useCategoryMarkets({
  enabled,
  locale,
  selectedCategory,
}: {
  enabled: boolean
  locale: string
  selectedCategory: string
}) {
  return useQuery({
    queryKey: ['affiliate-widget-category-markets', locale, selectedCategory],
    enabled: enabled && Boolean(selectedCategory),
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: ({ signal }) => fetchCategoryMarkets(selectedCategory, locale, signal),
  })
}

function useEmbedCode({
  selectedCategory,
  locale,
  theme,
  showVolume,
  showChart,
  showTimeRange,
  affiliateCode,
  embedElementName,
  embedIframeTitle,
  selectedMarketSlug,
}: {
  selectedCategory: string
  locale: string
  theme: EmbedTheme
  showVolume: boolean
  showChart: boolean
  showTimeRange: boolean
  affiliateCode: string
  embedElementName: string
  embedIframeTitle: string
  selectedMarketSlug: string
}) {
  const features = useMemo(
    () => buildFeatureList(showVolume, showChart, showTimeRange),
    [showVolume, showChart, showTimeRange],
  )
  const iframeHeight = showChart
    ? (showTimeRange ? IFRAME_HEIGHT_WITH_FILTERS : IFRAME_HEIGHT_WITH_CHART)
    : IFRAME_HEIGHT_NO_CHART
  const iframeSrc = useMemo(
    () =>
      buildAffiliateIframeSrc(
        SITE_URL,
        selectedCategory,
        locale,
        theme,
        features,
        affiliateCode,
      ),
    [selectedCategory, locale, theme, features, affiliateCode],
  )
  const previewSrc = useMemo(
    () =>
      buildAffiliatePreviewSrc(
        selectedCategory,
        locale,
        theme,
        features,
        affiliateCode,
      ),
    [selectedCategory, locale, theme, features, affiliateCode],
  )
  const iframeCode = useMemo(
    () => buildIframeCode(iframeSrc, iframeHeight, embedIframeTitle),
    [iframeSrc, iframeHeight, embedIframeTitle],
  )
  const webComponentCode = useMemo(
    () =>
      buildWebComponentCode(
        embedElementName,
        selectedMarketSlug,
        theme,
        showVolume,
        showChart,
        showTimeRange,
        affiliateCode,
      ),
    [embedElementName, selectedMarketSlug, theme, showVolume, showChart, showTimeRange, affiliateCode],
  )

  const iframeLines = useMemo<EmbedCodeLine[]>(() => ([
    tagOpenLine('', 'iframe'),
    attributeLine('\t', 'title', embedIframeTitle),
    attributeLine('\t', 'src', iframeSrc),
    attributeLine('\t', 'width', '400'),
    attributeLine('\t', 'height', String(iframeHeight)),
    attributeLine('\t', 'frameBorder', '0'),
    tagSelfCloseLine(''),
  ]), [embedIframeTitle, iframeSrc, iframeHeight])

  const webComponentLines = useMemo<EmbedCodeLine[]>(() => {
    const lines: EmbedCodeLine[] = [
      tagWithAttributeLine('', 'div', 'id', embedElementName, '>'),
      tagOpenLine('\t', 'script'),
      attributeLine('\t\t', 'type', 'module'),
      attributeLine('\t\t', 'src', EMBED_SCRIPT_URL),
      tagEndLine('\t'),
      tagCloseLine('\t', 'script'),
      tagOpenLine('\t', embedElementName),
      attributeLine('\t\t', 'market', selectedMarketSlug),
    ]

    if (showVolume) {
      lines.push(attributeLine('\t\t', 'volume', 'true'))
    }
    if (showChart) {
      lines.push(attributeLine('\t\t', 'chart', 'true'))
    }
    if (showChart && showTimeRange) {
      lines.push(attributeLine('\t\t', 'filters', 'true'))
    }
    if (affiliateCode) {
      lines.push(attributeLine('\t\t', 'affiliate', affiliateCode))
    }

    lines.push(attributeLine('\t\t', 'theme', theme))
    lines.push(tagSelfCloseLine('\t'))
    lines.push(tagCloseLine('', 'div'))
    return lines
  }, [affiliateCode, embedElementName, selectedMarketSlug, showVolume, showChart, showTimeRange, theme])

  return {
    iframeHeight,
    iframeSrc,
    previewSrc,
    iframeCode,
    webComponentCode,
    iframeLines,
    webComponentLines,
  }
}

export default function AffiliateWidgetDialog({
  open,
  onOpenChange,
  categories,
}: AffiliateWidgetDialogProps) {
  const t = useExtracted()
  const locale = useLocale()
  const site = useSiteIdentity()
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const {
    theme,
    setTheme,
    embedType,
    setEmbedType,
    showVolume,
    setShowVolume,
    showChart,
    showTimeRange,
    setShowTimeRange,
    handleShowChartChange,
  } = useEmbedOptions()
  const { copied, setCopied } = useCopyFlashState()
  const { selectedCategory, setSelectedCategoryState } = useEmbedCategorySelection(categories)
  const siteSlug = useSiteSlug(site.name)
  const { affiliateSharePercent, tradeFeePercent } = useAffiliateFeeSettings(affiliateCode)
  const {
    data: currentMarkets = [],
    isFetching: isFetchingCategory,
    isError: categoryLoadFailed,
  } = useCategoryMarkets({ enabled: open, locale, selectedCategory })
  const selectedMarket = currentMarkets[0]
  const embedElementName = `${siteSlug}-market-embed`
  const embedIframeTitle = `${siteSlug}-market-iframe`

  function handleSelectedCategoryChange(nextValue: string) {
    setSelectedCategoryState(nextValue)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCopied(false)
    }
    onOpenChange(nextOpen)
  }

  const {
    iframeHeight,
    iframeSrc,
    previewSrc,
    iframeCode,
    webComponentCode,
    iframeLines,
    webComponentLines,
  } = useEmbedCode({
    selectedCategory,
    locale,
    theme,
    showVolume,
    showChart,
    showTimeRange,
    affiliateCode,
    embedElementName,
    embedIframeTitle,
    selectedMarketSlug: selectedMarket?.slug ?? '',
  })
  const activeCode = embedType === 'iframe' ? iframeCode : webComponentCode
  const canCopy = embedType === 'iframe'
    ? Boolean(iframeSrc)
    : Boolean(selectedMarket?.slug)

  async function handleCopy() {
    if (!canCopy) {
      return
    }

    try {
      await navigator.clipboard.writeText(activeCode)
      setCopied(true)
      window.setTimeout(setCopied, 1500, false)
      maybeShowAffiliateToast({
        affiliateCode,
        affiliateSharePercent,
        tradeFeePercent,
        siteName: site.name,
        context: 'embed',
      })
    }
    catch (error) {
      console.error(error)
    }
  }

  const isLoadingCategory = isFetchingCategory

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl sm:p-8">
        <div className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">{t('Embed')}</DialogTitle>
          </DialogHeader>

          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('THEME')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['light', 'dark'] as EmbedTheme[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      className={cn(
                        'h-10 rounded-md border px-3 text-sm font-semibold transition-colors',
                        option === theme
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setTheme(option)}
                    >
                      {option === 'light' ? t('Light') : t('Dark')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('Categories')}</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={handleSelectedCategoryChange}
                  disabled={categories.length === 0}
                >
                  <SelectTrigger className={`
                    w-full bg-transparent text-sm
                    hover:bg-transparent
                    dark:bg-transparent
                    dark:hover:bg-transparent
                  `}
                  >
                    <SelectValue placeholder={t('Categories')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('OPTIONS')}</Label>
                <div className="rounded-md border border-border p-3">
                  <div className="flex flex-col gap-3 text-sm font-semibold text-foreground">
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Show Volume')}</span>
                      <Switch checked={showVolume} onCheckedChange={setShowVolume} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Show Chart')}</span>
                      <Switch checked={showChart} onCheckedChange={handleShowChartChange} />
                    </label>
                    {showChart
                      ? (
                          <label className="flex items-center justify-between gap-4">
                            <span>{t('Show Time Range Selector')}</span>
                            <Switch checked={showTimeRange} onCheckedChange={setShowTimeRange} />
                          </label>
                        )
                      : null}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('EMBED CODE')}</Label>
                  <div className="flex items-center gap-2">
                    <Select value={embedType} onValueChange={value => setEmbedType(value as EmbedType)}>
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iframe">{t('Iframe')}</SelectItem>
                        <SelectItem value="web-component">{t('Web component')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={!canCopy}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {t('Copy')}
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-border bg-muted/70 p-4">
                  {embedType === 'iframe'
                    ? (
                        iframeSrc
                          ? <EmbedCodePreview lines={iframeLines} />
                          : <p className="text-sm text-muted-foreground">{t('No market available for this event')}</p>
                      )
                    : selectedMarket
                      ? (
                          <EmbedCodePreview lines={webComponentLines} />
                        )
                      : (
                          <p className="text-sm text-muted-foreground">{t('No market available for this event')}</p>
                        )}
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col gap-3">
              <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('PREVIEW')}</Label>
              <div
                className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md bg-[#f7f7f9] p-2"
                style={{ minHeight: `${iframeHeight}px` }}
              >
                {isLoadingCategory
                  ? (
                      <p className="text-sm text-muted-foreground">{t('Searching events...')}</p>
                    )
                  : previewSrc
                    ? (
                        <iframe
                          title={t('Embed preview')}
                          src={previewSrc}
                          style={{ height: `${iframeHeight}px` }}
                          className="w-100 max-w-full border-0 bg-transparent"
                        />
                      )
                    : (
                        <p className="px-4 text-center text-sm text-muted-foreground">
                          {categoryLoadFailed
                            ? t('Unable to load widgets for this category. Please try again later.')
                            : t('No market available for this event')}
                        </p>
                      )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
