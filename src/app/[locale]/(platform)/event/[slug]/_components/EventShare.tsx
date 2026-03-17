import type { RefObject } from 'react'
import type { Event } from '@/types'
import { CheckIcon, ShareIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMarketSeriesLabel } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'
import { maybeShowAffiliateToast } from '@/lib/affiliate-toast'
import { resolveEventMarketPath, resolveEventPagePath } from '@/lib/events-routing'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const headerIconButtonClass = 'size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9'

interface EventShareProps {
  event: Event
}

interface AffiliateToastData {
  affiliateSharePercent: number | null
  tradeFeePercent: number | null
}

function parseAffiliateToastData(result: Awaited<ReturnType<typeof fetchAffiliateSettingsFromAPI>>): AffiliateToastData {
  if (!result.success) {
    return {
      affiliateSharePercent: null,
      tradeFeePercent: null,
    }
  }

  const shareParsed = Number.parseFloat(result.data.affiliateSharePercent)
  const feeParsed = Number.parseFloat(result.data.tradeFeePercent)

  return {
    affiliateSharePercent: Number.isFinite(shareParsed) && shareParsed > 0 ? shareParsed : null,
    tradeFeePercent: Number.isFinite(feeParsed) && feeParsed > 0 ? feeParsed : null,
  }
}

export default function EventShare({ event }: EventShareProps) {
  const site = useSiteIdentity()
  const [shareSuccess, setShareSuccess] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [affiliateSharePercent, setAffiliateSharePercent] = useState<number | null>(null)
  const [tradeFeePercent, setTradeFeePercent] = useState<number | null>(null)
  const [hasResolvedAffiliateToastData, setHasResolvedAffiliateToastData] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const affiliateToastDataRequestRef = useRef<Promise<AffiliateToastData> | null>(null)
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const isMultiMarket = event.total_markets_count > 1
  const eventPath = resolveEventPagePath(event)

  function relatedTargetIsWithin(ref: RefObject<HTMLElement | null>, relatedTarget: EventTarget | null) {
    const current = ref.current
    if (!current) {
      return false
    }

    const nodeConstructor = current.ownerDocument?.defaultView?.Node ?? Node
    if (!(relatedTarget instanceof nodeConstructor)) {
      return false
    }

    return current.contains(relatedTarget)
  }

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function handleWrapperPointerEnter() {
    clearCloseTimeout()
    setShareMenuOpen(true)
  }

  function handleWrapperPointerLeave(event: React.PointerEvent) {
    if (relatedTargetIsWithin(wrapperRef, event.relatedTarget)) {
      return
    }

    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      setShareMenuOpen(false)
    }, 120)
  }

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      clearCloseTimeout()
    }
  }, [])

  useEffect(() => {
    setAffiliateSharePercent(null)
    setTradeFeePercent(null)
    setHasResolvedAffiliateToastData(false)
    affiliateToastDataRequestRef.current = null
  }, [affiliateCode])

  const ensureAffiliateToastData = useCallback(async (): Promise<AffiliateToastData> => {
    if (!affiliateCode) {
      return {
        affiliateSharePercent: null,
        tradeFeePercent: null,
      }
    }

    if (hasResolvedAffiliateToastData) {
      return {
        affiliateSharePercent,
        tradeFeePercent,
      }
    }

    if (affiliateToastDataRequestRef.current) {
      return affiliateToastDataRequestRef.current
    }

    const request = fetchAffiliateSettingsFromAPI()
      .then((result) => {
        const nextData = parseAffiliateToastData(result)
        setAffiliateSharePercent(nextData.affiliateSharePercent)
        setTradeFeePercent(nextData.tradeFeePercent)
        setHasResolvedAffiliateToastData(result.success)
        return nextData
      })
      .catch(() => {
        const nextData = {
          affiliateSharePercent: null,
          tradeFeePercent: null,
        }
        setAffiliateSharePercent(nextData.affiliateSharePercent)
        setTradeFeePercent(nextData.tradeFeePercent)
        return nextData
      })
      .finally(() => {
        affiliateToastDataRequestRef.current = null
      })

    affiliateToastDataRequestRef.current = request
    return request
  }, [affiliateCode, affiliateSharePercent, hasResolvedAffiliateToastData, tradeFeePercent])

  useEffect(() => {
    if (!affiliateCode || !shareMenuOpen) {
      return
    }

    void ensureAffiliateToastData()
  }, [affiliateCode, ensureAffiliateToastData, shareMenuOpen])

  const showAffiliateToast = useCallback(async () => {
    const toastData = await ensureAffiliateToastData()

    maybeShowAffiliateToast({
      affiliateCode,
      affiliateSharePercent: toastData.affiliateSharePercent,
      tradeFeePercent: toastData.tradeFeePercent,
      siteName: site.name,
      context: 'link',
    })
  }, [affiliateCode, ensureAffiliateToastData, site.name])

  const debugPayload = useMemo(() => {
    return {
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
      },
      markets: event.markets.map(market => ({
        slug: market.slug,
        condition_id: market.condition_id,
        question_id: market.question_id,
        metadata_hash: market.condition?.metadata_hash ?? null,
        short_title: market.short_title ?? null,
        title: market.title,
        outcomes: market.outcomes.map(outcome => ({
          outcome_index: outcome.outcome_index,
          outcome_text: outcome.outcome_text,
          token_id: outcome.token_id,
        })),
      })),
    }
  }, [event.id, event.markets, event.slug, event.title])

  const handleDebugCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2))
    }
    catch (error) {
      console.error('Error copying debug payload:', error)
    }
  }, [debugPayload])

  const maybeHandleDebugCopy = useCallback((event: React.MouseEvent | React.PointerEvent) => {
    if (!event.altKey) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    void handleDebugCopy()
    return true
  }, [handleDebugCopy])

  const buildShareUrl = useCallback((path: string) => {
    const url = new URL(path, window.location.origin)
    if (affiliateCode) {
      url.searchParams.set('r', affiliateCode)
    }
    return url.toString()
  }, [affiliateCode])

  async function handleShare() {
    try {
      const url = buildShareUrl(eventPath)
      await navigator.clipboard.writeText(url)
      setShareSuccess(true)
      await showAffiliateToast()
      setTimeout(() => setShareSuccess(false), 2000)
    }
    catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  async function handleCopy(key: string, path: string) {
    try {
      const url = buildShareUrl(path)
      await navigator.clipboard.writeText(url)
      setCopiedKey(key)
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopiedKey(null), 1600)
      await showAffiliateToast()
    }
    catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  if (isMultiMarket) {
    return (
      <div
        ref={wrapperRef}
        onPointerEnter={handleWrapperPointerEnter}
        onPointerLeave={handleWrapperPointerLeave}
      >
        <DropdownMenu
          open={shareMenuOpen}
          onOpenChange={(open) => {
            clearCloseTimeout()
            setShareMenuOpen(open)
          }}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(headerIconButtonClass, 'size-auto p-0')}
              aria-label="Copy event link"
              onPointerDown={maybeHandleDebugCopy}
            >
              <ShareIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            className="max-h-80 w-48 border border-border bg-background p-0 text-foreground shadow-xl"
          >
            <DropdownMenuItem
              onSelect={(menuEvent) => {
                menuEvent.preventDefault()
                void handleCopy('event', eventPath)
              }}
              className={cn(
                'rounded-none px-3 py-2.5 text-sm font-semibold transition-colors first:rounded-t-md last:rounded-b-md',
                copiedKey === 'event' ? 'text-foreground' : 'text-muted-foreground',
                'hover:bg-muted/70 hover:text-foreground focus:bg-muted',
              )}
            >
              {copiedKey === 'event' ? 'Copied!' : 'Copy link'}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0 bg-border" />
            {event.markets
              .filter(market => market.slug)
              .map((market) => {
                const label = getMarketSeriesLabel(market)
                const key = `market-${market.condition_id}`
                return (
                  <DropdownMenuItem
                    key={market.condition_id}
                    onSelect={(menuEvent) => {
                      menuEvent.preventDefault()
                      void handleCopy(key, resolveEventMarketPath(event, market.slug))
                    }}
                    className={cn(
                      `
                        rounded-none px-3 py-2.5 text-sm font-semibold transition-colors
                        first:rounded-t-md
                        last:rounded-b-md
                      `,
                      copiedKey === key ? 'text-foreground' : 'text-muted-foreground',
                      'hover:bg-muted/70 hover:text-foreground focus:bg-muted',
                    )}
                  >
                    {copiedKey === key ? 'Copied!' : label}
                  </DropdownMenuItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(headerIconButtonClass, 'size-auto p-0')}
      onClick={(event) => {
        if (maybeHandleDebugCopy(event)) {
          return
        }
        void handleShare()
      }}
      aria-label="Copy event link"
    >
      {shareSuccess
        ? <CheckIcon className="size-4 text-primary" />
        : <ShareIcon className="size-4" />}
    </Button>
  )
}
