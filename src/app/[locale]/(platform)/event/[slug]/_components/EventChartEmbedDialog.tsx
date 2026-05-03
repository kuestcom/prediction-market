'use client'

import type { EmbedCodeLine } from '@/lib/embed-code'
import type { EmbedTheme } from '@/lib/embed-widget'
import type { Market } from '@/types'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/useIsMobile'
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
  buildIframeSrc,
  buildPreviewSrc,
  buildWebComponentCode,
  EMBED_SCRIPT_URL,
  normalizeEmbedBaseUrl,
  requireEmbedValue,
} from '@/lib/embed-widget'
import { slugifySiteName } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface EventChartEmbedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  markets: Market[]
  initialMarketId?: string | null
}

interface EditorState {
  copied: boolean
  embedType: EmbedType
  selectedMarketId: string
  showChart: boolean
  showTimeRange: boolean
  showVolume: boolean
  theme: EmbedTheme
}

interface AffiliateSettingsState {
  affiliateSharePercent: number | null
  builderTakerFeePercent: number | null
}

type EmbedType = 'iframe' | 'web-component'

const SITE_URL = normalizeEmbedBaseUrl(requireEmbedValue(process.env.SITE_URL, 'SITE_URL'))
const IFRAME_HEIGHT_WITH_CHART = 400
const IFRAME_HEIGHT_WITH_FILTERS = 440
const IFRAME_HEIGHT_NO_CHART = 180
const EMPTY_AFFILIATE_SETTINGS: AffiliateSettingsState = {
  affiliateSharePercent: null,
  builderTakerFeePercent: null,
}

function buildMarketLabel(market: Market) {
  return market.short_title?.trim() || market.title || market.slug
}

function getDefaultSelectedMarketId(markets: Market[], initialMarketId?: string | null) {
  if (initialMarketId && markets.some(market => market.condition_id === initialMarketId)) {
    return initialMarketId
  }

  return markets[0]?.condition_id ?? ''
}

function buildEditorKey(markets: Market[], initialMarketId?: string | null) {
  return `${initialMarketId ?? ''}:${markets.map(market => market.condition_id).join('|')}`
}

function useAffiliateSettings(affiliateCode: string) {
  const [affiliateSettings, setAffiliateSettings] = useState(EMPTY_AFFILIATE_SETTINGS)

  useEffect(function fetchAffiliateSettingsOnCodeChange() {
    if (!affiliateCode) {
      return
    }

    let isActive = true

    fetchAffiliateSettingsFromAPI()
      .then((result) => {
        if (!isActive) {
          return
        }

        if (result.success) {
          const shareParsed = Number.parseFloat(result.data.affiliateSharePercent)
          const feeParsed = Number.parseFloat(result.data.builderTakerFeePercent)

          setAffiliateSettings({
            affiliateSharePercent: Number.isFinite(shareParsed) && shareParsed > 0 ? shareParsed : null,
            builderTakerFeePercent: Number.isFinite(feeParsed) && feeParsed > 0 ? feeParsed : null,
          })
          return
        }

        setAffiliateSettings(EMPTY_AFFILIATE_SETTINGS)
      })
      .catch(() => {
        if (isActive) {
          setAffiliateSettings(EMPTY_AFFILIATE_SETTINGS)
        }
      })

    return function cancelAffiliateSettingsFetch() {
      isActive = false
    }
  }, [affiliateCode])

  return {
    affiliateSharePercent: affiliateCode ? affiliateSettings.affiliateSharePercent : null,
    builderTakerFeePercent: affiliateCode ? affiliateSettings.builderTakerFeePercent : null,
  }
}

function useEmbedCodeBuilders({
  embedBaseUrl,
  embedElementName,
  embedIframeTitle,
  marketSlug,
  theme,
  showVolume,
  showChart,
  effectiveShowTimeRange,
  affiliateCode,
  iframeHeight,
}: {
  embedBaseUrl: string
  embedElementName: string
  embedIframeTitle: string
  marketSlug: string
  theme: EmbedTheme
  showVolume: boolean
  showChart: boolean
  effectiveShowTimeRange: boolean
  affiliateCode: string
  iframeHeight: number
}) {
  const features = useMemo(() => {
    return buildFeatureList(showVolume, showChart, effectiveShowTimeRange)
  }, [showVolume, showChart, effectiveShowTimeRange])

  const iframeSrc = useMemo(() => {
    return buildIframeSrc(embedBaseUrl, marketSlug, theme, features, affiliateCode)
  }, [embedBaseUrl, marketSlug, theme, features, affiliateCode])

  const previewSrc = useMemo(() => {
    return buildPreviewSrc(marketSlug, theme, features, affiliateCode)
  }, [marketSlug, theme, features, affiliateCode])

  const iframeCode = useMemo(() => {
    return buildIframeCode(iframeSrc, iframeHeight, embedIframeTitle)
  }, [embedIframeTitle, iframeSrc, iframeHeight])

  const webComponentCode = useMemo(() => {
    return buildWebComponentCode(
      embedElementName,
      marketSlug,
      theme,
      showVolume,
      showChart,
      effectiveShowTimeRange,
      affiliateCode,
    )
  }, [embedElementName, marketSlug, theme, showVolume, showChart, effectiveShowTimeRange, affiliateCode])

  const iframeLines = useMemo<EmbedCodeLine[]>(() => {
    return [
      tagOpenLine('', 'iframe'),
      attributeLine('\t', 'title', embedIframeTitle),
      attributeLine('\t', 'src', iframeSrc),
      attributeLine('\t', 'width', '400'),
      attributeLine('\t', 'height', String(iframeHeight)),
      attributeLine('\t', 'frameBorder', '0'),
      tagSelfCloseLine(''),
    ]
  }, [embedIframeTitle, iframeSrc, iframeHeight])

  const webComponentLines = useMemo<EmbedCodeLine[]>(() => {
    const lines: EmbedCodeLine[] = [
      tagWithAttributeLine('', 'div', 'id', embedElementName, '>'),
      tagOpenLine('\t', 'script'),
      attributeLine('\t\t', 'type', 'module'),
      attributeLine('\t\t', 'src', EMBED_SCRIPT_URL),
      tagEndLine('\t'),
      tagCloseLine('\t', 'script'),
      tagOpenLine('\t', embedElementName),
      attributeLine('\t\t', 'market', marketSlug),
    ]

    if (showVolume) {
      lines.push(attributeLine('\t\t', 'volume', 'true'))
    }
    if (showChart) {
      lines.push(attributeLine('\t\t', 'chart', 'true'))
    }
    if (showChart && effectiveShowTimeRange) {
      lines.push(attributeLine('\t\t', 'filters', 'true'))
    }
    if (affiliateCode) {
      lines.push(attributeLine('\t\t', 'affiliate', affiliateCode))
    }

    lines.push(attributeLine('\t\t', 'theme', theme))
    lines.push(tagSelfCloseLine('\t'))
    lines.push(tagCloseLine('', 'div'))

    return lines
  }, [affiliateCode, embedElementName, marketSlug, showChart, effectiveShowTimeRange, showVolume, theme])

  return { features, iframeSrc, previewSrc, iframeCode, webComponentCode, iframeLines, webComponentLines }
}

function createInitialEditorState(markets: Market[], initialMarketId?: string | null): EditorState {
  return {
    copied: false,
    embedType: 'iframe',
    selectedMarketId: getDefaultSelectedMarketId(markets, initialMarketId),
    showChart: false,
    showTimeRange: false,
    showVolume: false,
    theme: 'light',
  }
}

function EventChartEmbedDialogEditor({
  markets,
  initialMarketId,
}: Pick<EventChartEmbedDialogProps, 'markets' | 'initialMarketId'>) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const user = useUser()
  const [editorState, setEditorState] = useState(() => createInitialEditorState(markets, initialMarketId))
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const { affiliateSharePercent, builderTakerFeePercent } = useAffiliateSettings(affiliateCode)
  const {
    copied,
    embedType,
    selectedMarketId,
    showChart,
    showTimeRange,
    showVolume,
    theme,
  } = editorState
  const showMarketSelector = markets.length > 1
  const showTimeRangeSelector = showChart
  const effectiveShowTimeRange = showChart && showTimeRange
  const siteSlug = useMemo(() => {
    try {
      return slugifySiteName(site.name)
    }
    catch {
      return 'market'
    }
  }, [site.name])
  const embedBaseUrl = SITE_URL
  const embedElementName = `${siteSlug}-market-embed`
  const embedIframeTitle = `${siteSlug}-market-iframe`

  const marketOptions = useMemo(() => {
    return markets.map(market => ({
      id: market.condition_id,
      label: buildMarketLabel(market),
    }))
  }, [markets])
  const selectedMarket = markets.find(market => market.condition_id === selectedMarketId) ?? markets[0]
  const marketSlug = selectedMarket?.slug ?? ''
  const iframeHeight = showChart
    ? (effectiveShowTimeRange ? IFRAME_HEIGHT_WITH_FILTERS : IFRAME_HEIGHT_WITH_CHART)
    : IFRAME_HEIGHT_NO_CHART

  const { iframeCode, webComponentCode, iframeLines, webComponentLines, previewSrc } = useEmbedCodeBuilders({
    embedBaseUrl,
    embedElementName,
    embedIframeTitle,
    marketSlug,
    theme,
    showVolume,
    showChart,
    effectiveShowTimeRange,
    affiliateCode,
    iframeHeight,
  })
  const activeCode = embedType === 'iframe' ? iframeCode : webComponentCode

  function handleThemeChange(nextTheme: EmbedTheme) {
    setEditorState(current => ({
      ...current,
      theme: nextTheme,
    }))
  }

  function handleMarketChange(nextMarketId: string) {
    setEditorState(current => ({
      ...current,
      selectedMarketId: nextMarketId,
    }))
  }

  function handleShowVolumeChange(nextShowVolume: boolean) {
    setEditorState(current => ({
      ...current,
      showVolume: nextShowVolume,
    }))
  }

  function handleShowChartChange(nextShowChart: boolean) {
    setEditorState(current => ({
      ...current,
      showChart: nextShowChart,
      showTimeRange: nextShowChart ? current.showTimeRange : false,
    }))
  }

  function handleShowTimeRangeChange(nextShowTimeRange: boolean) {
    setEditorState(current => ({
      ...current,
      showTimeRange: nextShowTimeRange,
    }))
  }

  function handleEmbedTypeChange(nextEmbedType: EmbedType) {
    setEditorState(current => ({
      ...current,
      embedType: nextEmbedType,
    }))
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeCode)
      setEditorState(current => ({
        ...current,
        copied: true,
      }))
      window.setTimeout(() => {
        setEditorState(current => ({
          ...current,
          copied: false,
        }))
      }, 1500)
      maybeShowAffiliateToast({
        affiliateCode,
        affiliateSharePercent,
        builderTakerFeePercent,
        siteName: site.name,
        context: 'embed',
      })
    }
    catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="grid items-stretch gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="order-2 min-w-0 space-y-6 lg:order-1">
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
                onClick={() => handleThemeChange(option)}
              >
                {option === 'light' ? t('Light') : t('Dark')}
              </button>
            ))}
          </div>
        </div>

        {showMarketSelector
          ? (
              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('MARKET')}</Label>
                <Select value={selectedMarketId} onValueChange={handleMarketChange}>
                  <SelectTrigger className={`
                    w-full bg-transparent text-sm
                    hover:bg-transparent
                    dark:bg-transparent
                    dark:hover:bg-transparent
                  `}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {marketOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          : null}

        <div className="space-y-3">
          <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('OPTIONS')}</Label>
          <div className="rounded-md border border-border p-3">
            <div className="flex flex-col gap-3 text-sm font-semibold text-foreground">
              <label className="flex items-center justify-between gap-4">
                <span>{t('Show Volume')}</span>
                <Switch checked={showVolume} onCheckedChange={handleShowVolumeChange} />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>{t('Show Chart')}</span>
                <Switch checked={showChart} onCheckedChange={handleShowChartChange} />
              </label>
              {showTimeRangeSelector
                ? (
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Show Time Range Selector')}</span>
                      <Switch checked={effectiveShowTimeRange} onCheckedChange={handleShowTimeRangeChange} />
                    </label>
                  )
                : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('EMBED CODE')}</Label>
            <div className="flex items-center gap-2">
              <Select value={embedType} onValueChange={value => handleEmbedTypeChange(value as EmbedType)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iframe">{t('Iframe')}</SelectItem>
                  <SelectItem value="web-component">{t('Web component')}</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {t('Copy')}
              </Button>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto rounded-md border border-border bg-muted/70 p-4">
            {embedType === 'iframe'
              ? <EmbedCodePreview lines={iframeLines} />
              : <EmbedCodePreview lines={webComponentLines} />}
          </div>
        </div>
      </div>

      <div className="order-1 flex h-full min-w-0 flex-col gap-3 lg:order-2">
        <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('PREVIEW')}</Label>
        <div
          className="flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-[#f7f7f9] p-2"
          style={{ minHeight: `${iframeHeight}px` }}
        >
          <iframe
            title={t('Embed preview')}
            src={previewSrc}
            style={{ height: `${iframeHeight}px` }}
            className="w-full max-w-[400px] border-0 bg-transparent"
          />
        </div>
      </div>
    </div>
  )
}

export default function EventChartEmbedDialog({
  open,
  onOpenChange,
  markets,
  initialMarketId,
}: EventChartEmbedDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const editorKey = buildEditorKey(markets, initialMarketId)
  const dialogBody = open
    ? <EventChartEmbedDialogEditor key={editorKey} markets={markets} initialMarketId={initialMarketId} />
    : null

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full overflow-hidden bg-background px-4 pt-4 pb-6">
          <VisuallyHidden>
            <DrawerTitle>{t('Embed')}</DrawerTitle>
          </VisuallyHidden>

          <div className="min-h-0 space-y-4 overflow-y-auto pr-1 sm:space-y-6">
            {dialogBody}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90vh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-3',
          'sm:w-full sm:max-w-4xl sm:p-8',
        )}
      >
        <VisuallyHidden>
          <DialogTitle>{t('Embed')}</DialogTitle>
        </VisuallyHidden>

        <div className="space-y-4 sm:space-y-6">
          {dialogBody}
        </div>
      </DialogContent>
    </Dialog>
  )
}
