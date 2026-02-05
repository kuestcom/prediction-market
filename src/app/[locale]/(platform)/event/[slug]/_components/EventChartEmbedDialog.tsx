'use client'

import type { Market } from '@/types'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'
import { maybeShowAffiliateToast } from '@/lib/affiliate-toast'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface EventChartEmbedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  markets: Market[]
  initialMarketId?: string | null
}

type EmbedType = 'iframe' | 'web-component'
type EmbedTheme = 'light' | 'dark'

function requireEnv(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for embeds.`)
  }
  return value
}

const SITE_NAME = requireEnv(process.env.NEXT_PUBLIC_SITE_NAME, 'NEXT_PUBLIC_SITE_NAME')
const SITE_URL = normalizeBaseUrl(requireEnv(process.env.SITE_URL, 'SITE_URL'))

function slugifySiteName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) {
    throw new Error('NEXT_PUBLIC_SITE_NAME must include at least one letter or number.')
  }
  return slug
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '')
}

const SITE_SLUG = slugifySiteName(SITE_NAME)
const EMBED_BASE_URL = SITE_URL
const EMBED_SCRIPT_URL = 'https://unpkg.com/@kuestcom/embeds/dist/index.js'
const EMBED_ELEMENT_NAME = `${SITE_SLUG}-market-embed`
const EMBED_IFRAME_TITLE = `${SITE_SLUG}-market-iframe`
const IFRAME_HEIGHT_WITH_CHART = 400
const IFRAME_HEIGHT_WITH_FILTERS = 440
const IFRAME_HEIGHT_NO_CHART = 180

const tokenStyles = {
  tag: 'text-muted-foreground',
  attr: 'text-red-500',
  value: 'text-rose-500',
  punctuation: 'text-muted-foreground',
}

interface CodeToken {
  text: string
  className?: string
}

type CodeLine = CodeToken[]

function buildMarketLabel(market: Market) {
  return market.short_title?.trim() || market.title || market.slug
}

function buildFeatureList(showVolume: boolean, showChart: boolean, showTimeRange: boolean) {
  const features: string[] = []
  if (showVolume) {
    features.push('volume')
  }
  if (showChart) {
    features.push('chart')
  }
  if (showChart && showTimeRange) {
    features.push('filters')
  }
  return features
}

function buildIframeSrc(marketSlug: string, theme: EmbedTheme, features: string[], affiliateCode?: string) {
  const params = new URLSearchParams({ market: marketSlug, theme })
  if (features.length > 0) {
    params.set('features', features.join(','))
  }
  if (affiliateCode) {
    params.set('r', affiliateCode)
  }
  return `${EMBED_BASE_URL}/market.html?${params.toString()}`
}

function buildPreviewSrc(marketSlug: string, theme: EmbedTheme, features: string[], affiliateCode?: string) {
  const params = new URLSearchParams({ market: marketSlug, theme })
  if (features.length > 0) {
    params.set('features', features.join(','))
  }
  if (affiliateCode) {
    params.set('r', affiliateCode)
  }
  return `/market.html?${params.toString()}`
}

function buildIframeCode(src: string, height: number) {
  return [
    '<iframe',
    `\ttitle="${EMBED_IFRAME_TITLE}"`,
    `\tsrc="${src}"`,
    '\twidth="400"',
    `\theight="${height}"`,
    '\tframeBorder="0"',
    '/>',
  ].join('\n')
}

function buildWebComponentCode(
  marketSlug: string,
  theme: EmbedTheme,
  showVolume: boolean,
  showChart: boolean,
  showTimeRange: boolean,
  affiliateCode?: string,
) {
  const lines = [
    `<div id="${EMBED_ELEMENT_NAME}">`,
    '\t<script',
    '\t\ttype="module"',
    `\t\tsrc="${EMBED_SCRIPT_URL}"`,
    '\t>',
    '\t</script>',
    `\t<${EMBED_ELEMENT_NAME}`,
    `\t\tmarket="${marketSlug}"`,
  ]

  if (showVolume) {
    lines.push('\t\tvolume="true"')
  }
  if (showChart) {
    lines.push('\t\tchart="true"')
  }
  if (showChart && showTimeRange) {
    lines.push('\t\tfilters="true"')
  }
  if (affiliateCode) {
    lines.push(`\t\taffiliate="${affiliateCode}"`)
  }

  lines.push(`\t\ttheme="${theme}"`)
  lines.push('\t/>')
  lines.push('</div>')
  return lines.join('\n')
}

function token(text: string, className?: string): CodeToken {
  return { text, className }
}

function tagOpenLine(indent: string, tagName: string): CodeLine {
  return [
    token(indent),
    token('<', tokenStyles.tag),
    token(tagName, tokenStyles.tag),
  ]
}

function tagWithAttributeLine(indent: string, tagName: string, attrName: string, attrValue: string, closing: string) {
  return [
    token(indent),
    token('<', tokenStyles.tag),
    token(tagName, tokenStyles.tag),
    token(' '),
    token(attrName, tokenStyles.attr),
    token('=', tokenStyles.punctuation),
    token('"', tokenStyles.punctuation),
    token(attrValue, tokenStyles.value),
    token('"', tokenStyles.punctuation),
    token(closing, tokenStyles.tag),
  ]
}

function attributeLine(indent: string, name: string, value: string): CodeLine {
  return [
    token(indent),
    token(name, tokenStyles.attr),
    token('=', tokenStyles.punctuation),
    token('"', tokenStyles.punctuation),
    token(value, tokenStyles.value),
    token('"', tokenStyles.punctuation),
  ]
}

function tagCloseLine(indent: string, tagName: string): CodeLine {
  return [
    token(indent),
    token('</', tokenStyles.tag),
    token(tagName, tokenStyles.tag),
    token('>', tokenStyles.tag),
  ]
}

function tagSelfCloseLine(indent: string): CodeLine {
  return [
    token(indent),
    token('/>', tokenStyles.tag),
  ]
}

function tagEndLine(indent: string): CodeLine {
  return [
    token(indent),
    token('>', tokenStyles.tag),
  ]
}

function renderCode(lines: CodeLine[]) {
  return (
    <pre className="min-w-max font-mono text-xs/5">
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="whitespace-pre">
          {line.map((segment, segmentIndex) => (
            <span key={segmentIndex} className={segment.className}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </pre>
  )
}

export default function EventChartEmbedDialog({
  open,
  onOpenChange,
  markets,
  initialMarketId,
}: EventChartEmbedDialogProps) {
  const t = useExtracted()
  const [theme, setTheme] = useState<EmbedTheme>('light')
  const [embedType, setEmbedType] = useState<EmbedType>('iframe')
  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [showVolume, setShowVolume] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [showTimeRange, setShowTimeRange] = useState(false)
  const [copied, setCopied] = useState(false)
  const showMarketSelector = markets.length > 1
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const [affiliateSharePercent, setAffiliateSharePercent] = useState<number | null>(null)
  const [tradeFeePercent, setTradeFeePercent] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    setTheme('light')
    setEmbedType('iframe')
    setShowVolume(false)
    setShowChart(false)
    setShowTimeRange(false)
    setCopied(false)
    setSelectedMarketId(initialMarketId ?? markets[0]?.condition_id ?? '')
  }, [open, initialMarketId, markets])

  useEffect(() => {
    if (!showChart) {
      setShowTimeRange(false)
    }
  }, [showChart])

  useEffect(() => {
    if (!affiliateCode) {
      setAffiliateSharePercent(null)
      setTradeFeePercent(null)
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
          const feeParsed = Number.parseFloat(result.data.tradeFeePercent)
          setAffiliateSharePercent(Number.isFinite(shareParsed) && shareParsed > 0 ? shareParsed : null)
          setTradeFeePercent(Number.isFinite(feeParsed) && feeParsed > 0 ? feeParsed : null)
        }
        else {
          setAffiliateSharePercent(null)
          setTradeFeePercent(null)
        }
      })
      .catch(() => {
        if (isActive) {
          setAffiliateSharePercent(null)
          setTradeFeePercent(null)
        }
      })

    return () => {
      isActive = false
    }
  }, [affiliateCode])

  useEffect(() => {
    if (!open) {
      return
    }
    if (!markets.some(market => market.condition_id === selectedMarketId)) {
      setSelectedMarketId(initialMarketId ?? markets[0]?.condition_id ?? '')
    }
  }, [open, markets, selectedMarketId, initialMarketId])

  const marketOptions = useMemo(
    () => markets.map(market => ({
      id: market.condition_id,
      label: buildMarketLabel(market),
    })),
    [markets],
  )
  const selectedMarket = markets.find(market => market.condition_id === selectedMarketId) ?? markets[0]
  const marketSlug = selectedMarket?.slug ?? ''

  const features = useMemo(
    () => buildFeatureList(showVolume, showChart, showTimeRange),
    [showVolume, showChart, showTimeRange],
  )
  const iframeSrc = useMemo(
    () => buildIframeSrc(marketSlug, theme, features, affiliateCode),
    [marketSlug, theme, features, affiliateCode],
  )
  const previewSrc = useMemo(
    () => buildPreviewSrc(marketSlug, theme, features, affiliateCode),
    [marketSlug, theme, features, affiliateCode],
  )
  const iframeHeight = showChart
    ? (showTimeRange ? IFRAME_HEIGHT_WITH_FILTERS : IFRAME_HEIGHT_WITH_CHART)
    : IFRAME_HEIGHT_NO_CHART
  const iframeCode = useMemo(() => buildIframeCode(iframeSrc, iframeHeight), [iframeSrc, iframeHeight])
  const webComponentCode = useMemo(
    () => buildWebComponentCode(marketSlug, theme, showVolume, showChart, showTimeRange, affiliateCode),
    [marketSlug, theme, showVolume, showChart, showTimeRange, affiliateCode],
  )
  const activeCode = embedType === 'iframe' ? iframeCode : webComponentCode

  const iframeLines = useMemo<CodeLine[]>(() => ([
    tagOpenLine('', 'iframe'),
    attributeLine('\t', 'title', EMBED_IFRAME_TITLE),
    attributeLine('\t', 'src', iframeSrc),
    attributeLine('\t', 'width', '400'),
    attributeLine('\t', 'height', String(iframeHeight)),
    attributeLine('\t', 'frameBorder', '0'),
    tagSelfCloseLine(''),
  ]), [iframeSrc, iframeHeight])

  const webComponentLines = useMemo<CodeLine[]>(() => {
    const lines: CodeLine[] = [
      tagWithAttributeLine('', 'div', 'id', EMBED_ELEMENT_NAME, '>'),
      tagOpenLine('\t', 'script'),
      attributeLine('\t\t', 'type', 'module'),
      attributeLine('\t\t', 'src', EMBED_SCRIPT_URL),
      tagEndLine('\t'),
      tagCloseLine('\t', 'script'),
      tagOpenLine('\t', EMBED_ELEMENT_NAME),
      attributeLine('\t\t', 'market', marketSlug),
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
  }, [marketSlug, showVolume, showChart, showTimeRange, theme, affiliateCode])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      maybeShowAffiliateToast({
        affiliateCode,
        affiliateSharePercent,
        tradeFeePercent,
        siteName: SITE_NAME,
        context: 'embed',
      })
    }
    catch (error) {
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

              {showMarketSelector
                ? (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('MARKET')}</Label>
                      <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                        <SelectTrigger className={`
                          w-full bg-transparent text-sm
                          hover:bg-transparent
                          dark:bg-transparent dark:hover:bg-transparent
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
                      <Switch checked={showVolume} onCheckedChange={setShowVolume} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Show Chart')}</span>
                      <Switch checked={showChart} onCheckedChange={setShowChart} />
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
                    <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {t('Copy')}
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-border bg-muted/70 p-4">
                  {embedType === 'iframe' ? renderCode(iframeLines) : renderCode(webComponentLines)}
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col gap-3">
              <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('PREVIEW')}</Label>
              <div
                className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-[#f7f7f9] p-2"
                style={{ minHeight: `${iframeHeight}px` }}
              >
                <iframe
                  title={t('Embed preview')}
                  src={previewSrc}
                  style={{ height: `${iframeHeight}px` }}
                  className="w-100 max-w-full border-0 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
