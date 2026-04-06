import type { Event } from '@/types'
import { LoaderIcon, SparkleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { generateMarketContextAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/generate-market-context'
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
  const t = useExtracted()
  const state = useOrder()
  const resolvedMarketConditionId = marketConditionId ?? state.market?.condition_id ?? undefined
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
  const isContentExpanded = isExpanded || Boolean(error)

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
        const response = await generateMarketContextAction({
          slug: event.slug,
          marketConditionId: resolvedMarketConditionId,
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

  useEffect(() => {
    setError(null)
    setContext(null)
    setIsExpanded(false)
    setHasGenerated(false)
    setCacheExpiresAtMs(null)
    setContextUpdatedAtMs(null)

    if (!resolvedMarketConditionId) {
      return
    }

    let isActive = true

    async function preloadCachedContext() {
      try {
        const response = await generateMarketContextAction({
          slug: event.slug,
          marketConditionId: resolvedMarketConditionId,
          readOnly: true,
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
        console.error('Failed to fetch cached market context.', caughtError)
      }
    }

    void preloadCachedContext()

    return () => {
      isActive = false
    }
  }, [event.slug, resolvedMarketConditionId])

  useEffect(() => {
    if (!cacheExpiresAtMs) {
      return
    }

    const remainingMs = cacheExpiresAtMs - Date.now()

    if (remainingMs <= 0) {
      setHasGenerated(false)
      setContext(null)
      setIsExpanded(false)
      setCacheExpiresAtMs(null)
      setContextUpdatedAtMs(null)
      return
    }

    const timeout = window.setTimeout(() => {
      setHasGenerated(false)
      setContext(null)
      setIsExpanded(false)
      setCacheExpiresAtMs(null)
      setContextUpdatedAtMs(null)
    }, remainingMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [cacheExpiresAtMs])

  useEffect(() => {
    if (contextRef.current !== context) {
      contextRef.current = context
      hasAnimatedRef.current = false
    }

    if (!context) {
      setDisplayedContext('')
      setIsTyping(false)
      return
    }

    if (!isExpanded) {
      setDisplayedContext(context)
      setIsTyping(false)
      return
    }

    if (hasAnimatedRef.current) {
      return
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayedContext(context)
      setIsTyping(false)
      hasAnimatedRef.current = true
      return
    }

    const fullContext = context
    const totalDurationMs = Math.min(2400, Math.max(900, fullContext.length * 12))
    const start = performance.now()
    let animationFrame = 0

    setIsTyping(true)
    setDisplayedContext('')

    function tick(now: number) {
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

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }
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

  function toggleCollapse() {
    setIsExpanded(current => !current)
  }

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
