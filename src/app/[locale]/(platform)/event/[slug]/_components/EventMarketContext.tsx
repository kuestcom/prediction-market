import type { Event } from '@/types'
import { LoaderIcon, SparkleIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'

interface EventMarketContextProps {
  event: Event
  marketConditionId?: string | null
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

function formatContextUpdatedLabel(updatedAtMs: number | null) {
  if (!updatedAtMs) {
    return 'Experimental AI-generated summary'
  }

  const date = new Date(updatedAtMs)
  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  const timezonePart = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'shortOffset',
  }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? 'GMT'

  return `Experimental AI-generated summary · Updated ${datePart} at ${timePart} ${timezonePart}`
}

export default function EventMarketContext({ event, marketConditionId = null }: EventMarketContextProps) {
  const state = useOrder()
  const resolvedMarketConditionId = marketConditionId ?? state.market?.condition_id ?? undefined
  const contextKey = `${event.slug}:${resolvedMarketConditionId ?? 'none'}`

  return (
    <EventMarketContextContent
      key={contextKey}
      event={event}
      resolvedMarketConditionId={resolvedMarketConditionId}
    />
  )
}

interface EventMarketContextContentProps {
  event: Event
  resolvedMarketConditionId?: string
}

interface MarketContextResponse {
  error?: string
  context?: string | null
  expiresAt?: string | null
  updatedAt?: string | null
}

async function requestMarketContext({
  slug,
  marketConditionId,
  readOnly = false,
  locale,
  signal,
}: {
  slug: string
  marketConditionId: string
  readOnly?: boolean
  locale: string
  signal?: AbortSignal
}): Promise<MarketContextResponse> {
  const response = await fetch('/api/market-context', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Kuest-Locale': locale,
    },
    body: JSON.stringify({
      slug,
      marketConditionId,
      readOnly,
      locale,
    }),
    signal,
  })

  const payload = await response.json().catch(() => null) as MarketContextResponse | null

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid market context response payload.')
  }

  if (!response.ok && !payload.error) {
    throw new Error(`Failed to fetch market context (${response.status}).`)
  }

  return payload
}

function useMarketContextState(event: Event, resolvedMarketConditionId: string | undefined) {
  const t = useExtracted()
  const locale = useLocale()
  const [isExpanded, setIsExpanded] = useState(false)
  const [context, setContext] = useState<string | null>(null)
  const [displayedContext, setDisplayedContext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasGenerated, setHasGenerated] = useState(false)
  const [cacheExpiresAtMs, setCacheExpiresAtMs] = useState<number | null>(null)
  const [contextUpdatedAtMs, setContextUpdatedAtMs] = useState<number | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const hasAnimatedRef = useRef(false)
  const contextRef = useRef<string | null>(null)

  useEffect(function preloadCachedContextEffect() {
    if (!resolvedMarketConditionId) {
      return
    }

    let isActive = true
    const abortController = new AbortController()

    async function preloadCachedContext() {
      try {
        const response = await requestMarketContext({
          slug: event.slug,
          marketConditionId: `${resolvedMarketConditionId}`,
          readOnly: true,
          locale,
          signal: abortController.signal,
        })

        if (!isActive || response?.error || !response?.context) {
          return
        }

        setContext(response.context)
        setHasGenerated(true)
        setCacheExpiresAtMs(parseTimestamp(response.expiresAt))
        setContextUpdatedAtMs(parseTimestamp(response.updatedAt) ?? Date.now())
      }
      catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') {
          return
        }

        console.error('Failed to fetch cached market context.', caughtError)
      }
    }

    void preloadCachedContext()

    return function cleanupPreload() {
      isActive = false
      abortController.abort()
    }
  }, [event.slug, locale, resolvedMarketConditionId])

  useEffect(function cacheExpirationEffect() {
    if (!cacheExpiresAtMs) {
      return
    }

    const remainingMs = Math.max(0, cacheExpiresAtMs - Date.now())
    const timeout = window.setTimeout(() => {
      setHasGenerated(false)
      setContext(null)
      setIsExpanded(false)
      setCacheExpiresAtMs(null)
      setContextUpdatedAtMs(null)
    }, remainingMs)

    return function cleanupCacheExpiration() {
      window.clearTimeout(timeout)
    }
  }, [cacheExpiresAtMs])

  useEffect(function typewriterAnimationEffect() {
    let isActive = true
    let animationFrame = 0
    let contextDisplayFrame = 0

    function cancelScheduledFrames() {
      if (contextDisplayFrame) {
        window.cancelAnimationFrame(contextDisplayFrame)
        contextDisplayFrame = 0
      }

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
    }

    function scheduleContextDisplay(nextContext: string, nextIsTyping: boolean) {
      if (contextDisplayFrame) {
        window.cancelAnimationFrame(contextDisplayFrame)
      }

      contextDisplayFrame = window.requestAnimationFrame(() => {
        if (!isActive) {
          return
        }

        setDisplayedContext(current => (current === nextContext ? current : nextContext))
        setIsTyping(current => (current === nextIsTyping ? current : nextIsTyping))
      })
    }

    if (contextRef.current !== context) {
      contextRef.current = context
      hasAnimatedRef.current = false
    }

    if (!context) {
      scheduleContextDisplay('', false)
      return function cleanupNoContext() {
        isActive = false
        cancelScheduledFrames()
      }
    }

    if (!isExpanded) {
      scheduleContextDisplay(context, false)
      return function cleanupNotExpanded() {
        isActive = false
        cancelScheduledFrames()
      }
    }

    if (hasAnimatedRef.current) {
      return function cleanupAlreadyAnimated() {
        isActive = false
        cancelScheduledFrames()
      }
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scheduleContextDisplay(context, false)
      hasAnimatedRef.current = true
      return function cleanupReducedMotion() {
        isActive = false
        cancelScheduledFrames()
      }
    }

    const fullContext = context
    const totalDurationMs = Math.min(2400, Math.max(900, fullContext.length * 12))
    const start = performance.now()

    scheduleContextDisplay('', true)

    function tick(now: number) {
      if (!isActive) {
        return
      }

      const progress = Math.min(1, (now - start) / totalDurationMs)
      const nextLength = Math.max(1, Math.floor(progress * fullContext.length))
      setDisplayedContext(fullContext.slice(0, nextLength))

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick)
      }
      else {
        setIsTyping(false)
        hasAnimatedRef.current = true
      }
    }

    animationFrame = window.requestAnimationFrame(tick)

    return function cleanupAnimation() {
      isActive = false
      cancelScheduledFrames()
    }
  }, [context, isExpanded])

  const paragraphs = useMemo(() => {
    if (!displayedContext) {
      return []
    }

    return displayedContext
      .split(/\n{2,}|\r\n{2,}/)
      .map(block => block.trim())
      .filter(Boolean)
  }, [displayedContext])

  const updatedLabel = useMemo(() => formatContextUpdatedLabel(contextUpdatedAtMs), [contextUpdatedAtMs])

  async function generateMarketContext() {
    if (!resolvedMarketConditionId) {
      return
    }
    if (isPending) {
      return
    }

    startTransition(async () => {
      setError(null)

      try {
        const response = await requestMarketContext({
          slug: event.slug,
          marketConditionId: resolvedMarketConditionId,
          locale,
        })

        if (response?.error) {
          setError(response.error)
          setContext(null)
          setIsExpanded(false)
          setHasGenerated(false)
          setCacheExpiresAtMs(null)
          setContextUpdatedAtMs(null)
          return
        }

        if (response?.context) {
          setContext(response.context)
          setIsExpanded(true)
          setHasGenerated(true)
          setCacheExpiresAtMs(parseTimestamp(response.expiresAt))
          setContextUpdatedAtMs(parseTimestamp(response.updatedAt) ?? Date.now())
        }
      }
      catch (caughtError) {
        console.error('Failed to fetch market context.', caughtError)
        setError(t('Unable to reach the market context service right now.'))
        setContext(null)
        setIsExpanded(false)
        setHasGenerated(false)
        setCacheExpiresAtMs(null)
        setContextUpdatedAtMs(null)
      }
    })
  }

  function toggleCollapse() {
    setIsExpanded(current => !current)
  }

  return {
    isExpanded,
    context,
    displayedContext,
    error,
    isPending,
    hasGenerated,
    isTyping,
    paragraphs,
    updatedLabel,
    generateMarketContext,
    toggleCollapse,
    resolvedMarketConditionId,
  }
}

function EventMarketContextContent({ event, resolvedMarketConditionId }: EventMarketContextContentProps) {
  const t = useExtracted()
  const {
    isExpanded,
    context,
    displayedContext,
    error,
    isPending,
    hasGenerated,
    isTyping,
    paragraphs,
    updatedLabel,
    generateMarketContext,
    toggleCollapse,
  } = useMarketContextState(event, resolvedMarketConditionId)
  const isContentExpanded = isExpanded || Boolean(error)

  return (
    <section className="overflow-hidden rounded-xl border transition-all duration-500 ease-in-out">
      {hasGenerated
        ? (
            <button
              type="button"
              onClick={toggleCollapse}
              className={cn(
                `
                  flex h-18 w-full items-center justify-between p-4 text-left transition-colors
                  hover:bg-muted/50
                  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                  focus-visible:ring-offset-background focus-visible:outline-none
                `,
              )}
              aria-expanded={isExpanded}
            >
              <h3 className="text-base font-medium">{t('Market Context')}</h3>
              <span
                aria-hidden="true"
                className="pointer-events-none flex size-8 items-center justify-center"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={cn('size-6 text-muted-foreground transition-transform', { 'rotate-180': isExpanded })}
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          )
        : (
            <button
              type="button"
              onClick={generateMarketContext}
              className={cn(
                `
                  flex h-18 w-full items-center justify-between p-4 text-left transition-colors
                  hover:bg-muted/50
                  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                  focus-visible:ring-offset-background focus-visible:outline-none
                `,
                { 'rounded-b-none': isContentExpanded },
              )}
              disabled={isPending || !resolvedMarketConditionId}
            >
              <span className="text-base font-medium">{t('Market Context')}</span>
              <span
                className={`
                  flex items-center gap-1 rounded-md border bg-background px-3 py-1 text-sm font-medium text-foreground
                  shadow-sm transition
                `}
              >
                {isPending ? <LoaderIcon className="size-3 animate-spin" /> : <SparkleIcon className="size-3" />}
                {isPending ? t('Generating...') : t('Generate')}
              </span>
            </button>
          )}

      <div
        className={cn(`
          grid overflow-hidden transition-all duration-500 ease-in-out
          ${isContentExpanded
      ? 'pointer-events-auto grid-rows-[1fr] opacity-100'
      : 'pointer-events-none grid-rows-[0fr] opacity-0'}
        `)}
        aria-hidden={!isContentExpanded}
      >
        <div
          className={cn('min-h-0 overflow-hidden', { 'border-t border-border/30': isContentExpanded })}
        >
          <div className="space-y-3 p-3">
            {error && (
              <p className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            {paragraphs.map(paragraph => (
              <p
                key={paragraph}
                className="text-sm/relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}

            {!error && context && !isTyping && displayedContext === context && (
              <div className="flex justify-end">
                <span className="font-mono text-2xs tracking-wide text-muted-foreground/80">
                  {updatedLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
