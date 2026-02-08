import type { RefObject } from 'react'
import type { Event } from '@/types'
import { CheckIcon, LinkIcon } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const headerIconButtonClass = 'size-10 rounded-sm border border-transparent bg-transparent text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9'

interface EventShareProps {
  event: Event
}

export default function EventShare({ event }: EventShareProps) {
  const site = useSiteIdentity()
  const [shareSuccess, setShareSuccess] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [affiliateSharePercent, setAffiliateSharePercent] = useState<number | null>(null)
  const [tradeFeePercent, setTradeFeePercent] = useState<number | null>(null)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const isMultiMarket = event.total_markets_count > 1

  function relatedTargetIsWithin(ref: RefObject<HTMLElement | null>, relatedTarget: EventTarget | null) {
    if (!relatedTarget) {
      return false
    }

    return Boolean(ref.current?.contains(relatedTarget as Node))
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

  const showAffiliateToast = useCallback(() => {
    maybeShowAffiliateToast({
      affiliateCode,
      affiliateSharePercent,
      tradeFeePercent,
      siteName: site.name,
      context: 'link',
    })
  }, [affiliateCode, affiliateSharePercent, site.name, tradeFeePercent])

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
      const url = buildShareUrl(`/event/${event.slug}`)
      await navigator.clipboard.writeText(url)
      setShareSuccess(true)
      showAffiliateToast()
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
      showAffiliateToast()
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
              <LinkIcon className="size-4 -scale-x-100" />
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
                void handleCopy('event', `/event/${event.slug}`)
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
                      void handleCopy(key, `/event/${event.slug}/${market.slug}`)
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
        : <LinkIcon className="size-4 -scale-x-100" />}
    </Button>
  )
}
