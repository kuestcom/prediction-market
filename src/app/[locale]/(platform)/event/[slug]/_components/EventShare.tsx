import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ShareIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Event } from '@/types'

import { getMarketSeriesLabel } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import { isMarketResolved } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventMarketUtils'
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

const headerIconButtonClass =
  'size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9'

interface EventShareProps {
  event: Event
}

interface AffiliateToastData {
  affiliateSharePercent: number | null
  builderTakerSharePercent: number | null
}

function getEmptyAffiliateToastData(): AffiliateToastData {
  return {
    affiliateSharePercent: null,
    builderTakerSharePercent: null,
  }
}

function parseAffiliateToastData(result: {
  affiliateSharePercent: string
  builderTakerSharePercent: string
}): AffiliateToastData {
  const shareParsed = Number.parseFloat(result.affiliateSharePercent)
  const feeParsed = Number.parseFloat(result.builderTakerSharePercent)

  return {
    affiliateSharePercent: Number.isFinite(shareParsed) && shareParsed > 0 ? shareParsed : null,
    builderTakerSharePercent: Number.isFinite(feeParsed) && feeParsed > 0 ? feeParsed : null,
  }
}

const MENU_CLOSE_DELAY_MS = 120
const COPY_FEEDBACK_DURATION_MS = 1600
const SHARE_SUCCESS_FEEDBACK_DURATION_MS = 2000

function getMarketEndTime(market: Event['markets'][number]) {
  if (!market.end_time) {
    return null
  }

  const parsed = Date.parse(market.end_time)
  return Number.isNaN(parsed) ? null : parsed
}

function sortMarketsByEndTime(markets: Event['markets']) {
  return markets
    .map((market, index) => ({
      market,
      index,
      endTime: getMarketEndTime(market),
    }))
    .sort((a, b) => {
      if (a.endTime == null && b.endTime == null) {
        return a.index - b.index
      }
      if (a.endTime == null) {
        return 1
      }
      if (b.endTime == null) {
        return -1
      }
      return a.endTime - b.endTime
    })
    .map((item) => item.market)
}

function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)
  const shareSuccessTimeoutRef = useRef<number | null>(null)

  useEffect(function clearFeedbackTimeoutsOnUnmount() {
    return function clearFeedbackTimeouts() {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      if (shareSuccessTimeoutRef.current != null) {
        window.clearTimeout(shareSuccessTimeoutRef.current)
      }
    }
  }, [])

  function markKeyAsCopied(key: string) {
    setCopiedKey(key)
    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = window.setTimeout(setCopiedKey, COPY_FEEDBACK_DURATION_MS, null)
  }

  function markShareSuccess(duration: number) {
    setShareSuccess(true)
    if (shareSuccessTimeoutRef.current != null) {
      window.clearTimeout(shareSuccessTimeoutRef.current)
    }
    shareSuccessTimeoutRef.current = window.setTimeout(setShareSuccess, duration, false)
  }

  return { copiedKey, markKeyAsCopied, markShareSuccess, shareSuccess }
}

function useShareMenuHover() {
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  useEffect(function clearCloseTimeoutOnUnmount() {
    return function clearMenuCloseTimeout() {
      clearCloseTimeout()
    }
  }, [])

  function relatedTargetIsInsideWrapper(relatedTarget: EventTarget | null) {
    const current = wrapperRef.current
    if (!current) {
      return false
    }

    const nodeConstructor = current.ownerDocument?.defaultView?.Node ?? Node
    if (!(relatedTarget instanceof nodeConstructor)) {
      return false
    }

    return current.contains(relatedTarget)
  }

  function scheduleClose() {
    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(function closeMenuAfterDelay() {
      setShareMenuOpen(false)
    }, MENU_CLOSE_DELAY_MS)
  }

  return {
    shareMenuOpen,
    setShareMenuOpen,
    wrapperRef,
    clearCloseTimeout,
    scheduleClose,
    relatedTargetIsInsideWrapper,
  }
}

function useAffiliateToastData({ affiliateCode, siteName }: { affiliateCode: string; siteName: string }) {
  const queryClient = useQueryClient()

  const ensureAffiliateToastData = useCallback(async (): Promise<AffiliateToastData> => {
    if (!affiliateCode) {
      return getEmptyAffiliateToastData()
    }

    try {
      return await queryClient.fetchQuery({
        queryKey: ['affiliate-toast-data', affiliateCode],
        queryFn: async () => {
          const result = await fetchAffiliateSettingsFromAPI()
          if (!result.success) {
            throw new Error(result.error.error)
          }
          return parseAffiliateToastData(result.data)
        },
        staleTime: Number.POSITIVE_INFINITY,
      })
    } catch {
      return getEmptyAffiliateToastData()
    }
  }, [affiliateCode, queryClient])

  function prefetchAffiliateToastData() {
    if (!affiliateCode) {
      return
    }

    void ensureAffiliateToastData()
  }

  const showAffiliateToast = useCallback(async () => {
    const toastData = await ensureAffiliateToastData()

    maybeShowAffiliateToast({
      affiliateCode,
      affiliateSharePercent: toastData.affiliateSharePercent,
      builderTakerSharePercent: toastData.builderTakerSharePercent,
      siteName,
      context: 'link',
    })
  }, [affiliateCode, ensureAffiliateToastData, siteName])

  return { prefetchAffiliateToastData, showAffiliateToast }
}

function useDebugCopy(event: Event) {
  const debugPayload = useMemo(
    function buildDebugPayload() {
      return {
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
        },
        markets: event.markets.map((market) => ({
          slug: market.slug,
          condition_id: market.condition_id,
          question_id: market.question_id,
          metadata_hash: market.condition?.metadata_hash ?? null,
          short_title: market.short_title ?? null,
          title: market.title,
          outcomes: market.outcomes.map((outcome) => ({
            outcome_index: outcome.outcome_index,
            outcome_text: outcome.outcome_text,
            token_id: outcome.token_id,
          })),
        })),
      }
    },
    [event.id, event.markets, event.slug, event.title],
  )

  const handleDebugCopy = useCallback(
    async function handleDebugCopy() {
      try {
        await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2))
      } catch (error) {
        console.error('Error copying debug payload:', error)
      }
    },
    [debugPayload],
  )

  const maybeHandleDebugCopy = useCallback(
    (triggerEvent: React.MouseEvent | React.PointerEvent) => {
      if (!triggerEvent.altKey) {
        return false
      }

      triggerEvent.preventDefault()
      triggerEvent.stopPropagation()
      void handleDebugCopy()
      return true
    },
    [handleDebugCopy],
  )

  return { maybeHandleDebugCopy }
}

function useShareUrlBuilder(affiliateCode: string) {
  return useCallback(
    (path: string) => {
      const url = new URL(path, window.location.origin)
      if (affiliateCode) {
        url.searchParams.set('r', affiliateCode)
      }
      return url.toString()
    },
    [affiliateCode],
  )
}

export default function EventShare({ event }: EventShareProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const user = useUser()
  const affiliateCode = user?.username?.trim() || user?.affiliate_code?.trim() || ''
  const isMultiMarket = event.total_markets_count > 1
  const eventPath = resolveEventPagePath(event)
  const { activeMarkets, resolvedMarkets } = useMemo(() => {
    const shareableMarkets = event.markets.filter((market) => market.slug)

    return {
      activeMarkets: sortMarketsByEndTime(shareableMarkets.filter((market) => !isMarketResolved(market))),
      resolvedMarkets: sortMarketsByEndTime(shareableMarkets.filter((market) => isMarketResolved(market))),
    }
  }, [event.markets])

  const { copiedKey, markKeyAsCopied, markShareSuccess, shareSuccess } = useCopyFeedback()
  const {
    shareMenuOpen,
    setShareMenuOpen,
    wrapperRef,
    clearCloseTimeout,
    scheduleClose,
    relatedTargetIsInsideWrapper,
  } = useShareMenuHover()
  const { prefetchAffiliateToastData, showAffiliateToast } = useAffiliateToastData({
    affiliateCode,
    siteName: site.name,
  })
  const { maybeHandleDebugCopy } = useDebugCopy(event)
  const buildShareUrl = useShareUrlBuilder(affiliateCode)

  useEffect(
    function closeShareMenuOnScroll() {
      if (!shareMenuOpen) {
        return
      }

      function closeMenu() {
        setShareMenuOpen(false)
      }

      window.addEventListener('scroll', closeMenu, { passive: true })
      return function removeScrollListener() {
        window.removeEventListener('scroll', closeMenu)
      }
    },
    [shareMenuOpen, setShareMenuOpen],
  )

  function handleWrapperPointerEnter(pointerEvent: React.PointerEvent) {
    if (pointerEvent.pointerType !== 'mouse') {
      return
    }

    clearCloseTimeout()
    setShareMenuOpen(true)
    prefetchAffiliateToastData()
  }

  function handleWrapperPointerLeave(pointerEvent: React.PointerEvent) {
    if (pointerEvent.pointerType !== 'mouse') {
      return
    }

    if (relatedTargetIsInsideWrapper(pointerEvent.relatedTarget)) {
      return
    }

    scheduleClose()
  }

  async function handleShare() {
    try {
      const url = buildShareUrl(eventPath)
      await navigator.clipboard.writeText(url)
      markShareSuccess(SHARE_SUCCESS_FEEDBACK_DURATION_MS)
      await showAffiliateToast()
    } catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  async function handleCopy(key: string, path: string) {
    try {
      const url = buildShareUrl(path)
      await navigator.clipboard.writeText(url)
      markKeyAsCopied(key)
      markShareSuccess(SHARE_SUCCESS_FEEDBACK_DURATION_MS)
      setShareMenuOpen(false)
      await showAffiliateToast()
    } catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  function renderMarketItem(market: Event['markets'][number]) {
    const label = getMarketSeriesLabel(market)
    const key = `market-${market.condition_id}`

    return (
      <DropdownMenuItem
        key={market.condition_id}
        closeOnClick={false}
        onClick={() => {
          void handleCopy(key, resolveEventMarketPath(event, market.slug))
        }}
        className={cn('py-2 text-sm font-semibold', copiedKey === key ? 'text-foreground' : 'text-muted-foreground')}
      >
        {copiedKey === key ? t('Copied!') : label}
      </DropdownMenuItem>
    )
  }

  if (isMultiMarket) {
    return (
      <div ref={wrapperRef} onPointerEnter={handleWrapperPointerEnter} onPointerLeave={handleWrapperPointerLeave}>
        <DropdownMenu
          open={shareMenuOpen}
          onOpenChange={(open) => {
            clearCloseTimeout()
            setShareMenuOpen(open)
            if (open) {
              prefetchAffiliateToastData()
            }
          }}
          modal={false}
        >
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(headerIconButtonClass, 'size-auto p-0')}
                aria-label={t('Copy event link')}
                onPointerDown={maybeHandleDebugCopy}
              />
            }
          >
            {shareSuccess ? <CheckIcon className="size-4 text-primary" /> : <ShareIcon className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            className="max-h-56 w-48 overscroll-contain border border-border bg-background p-1 text-foreground shadow-xl"
          >
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() => {
                void handleCopy('event', eventPath)
              }}
              className={cn(
                'py-2 text-sm font-semibold',
                copiedKey === 'event' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {copiedKey === 'event' ? t('Copied!') : t('Copy link')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {activeMarkets.map(renderMarketItem)}
            {activeMarkets.length > 0 && resolvedMarkets.length > 0 && <DropdownMenuSeparator />}
            {resolvedMarkets.map(renderMarketItem)}
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
      aria-label={t('Copy event link')}
    >
      {shareSuccess ? <CheckIcon className="size-4 text-primary" /> : <ShareIcon className="size-4" />}
    </Button>
  )
}
