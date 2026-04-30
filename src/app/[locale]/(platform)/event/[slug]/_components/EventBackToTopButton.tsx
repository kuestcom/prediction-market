'use client'

import { ArrowUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const DEFAULT_WINDOW_VIEWPORT_SNAPSHOT = {
  scrollY: 0,
  viewportWidth: 0,
}
const DESKTOP_BACK_TO_TOP_BREAKPOINT = 1024

let windowViewportSnapshot = DEFAULT_WINDOW_VIEWPORT_SNAPSHOT

function subscribeWindowViewport(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('scroll', onStoreChange, { passive: true })
  window.addEventListener('resize', onStoreChange)
  return () => {
    window.removeEventListener('scroll', onStoreChange)
    window.removeEventListener('resize', onStoreChange)
  }
}

function getWindowViewportSnapshot() {
  if (typeof window === 'undefined') {
    return DEFAULT_WINDOW_VIEWPORT_SNAPSHOT
  }

  const scrollY = window.scrollY
  const viewportWidth = window.innerWidth
  if (windowViewportSnapshot.scrollY === scrollY && windowViewportSnapshot.viewportWidth === viewportWidth) {
    return windowViewportSnapshot
  }

  windowViewportSnapshot = {
    scrollY,
    viewportWidth,
  }
  return windowViewportSnapshot
}

function useWindowViewport() {
  return useSyncExternalStore(
    subscribeWindowViewport,
    getWindowViewportSnapshot,
    () => DEFAULT_WINDOW_VIEWPORT_SNAPSHOT,
  )
}

function useNavigationViewportReady() {
  const pathname = usePathname()
  const [settledPathname, setSettledPathname] = useState<string | null>(null)

  useEffect(function markNavigationViewportReady() {
    let firstFrameId = 0
    let secondFrameId = 0

    firstFrameId = window.requestAnimationFrame(function waitForNavigationScrollFrame() {
      secondFrameId = window.requestAnimationFrame(function markNavigationViewportSettled() {
        setSettledPathname(pathname)
      })
    })

    return function cancelNavigationViewportReady() {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
    }
  }, [pathname])

  return settledPathname === pathname
}

function useBackToTopBounds({
  enabled,
  scrollY,
  viewportWidth,
}: {
  enabled: boolean
  scrollY: number
  viewportWidth: number
}) {
  return useMemo(() => {
    if (!enabled || typeof document === 'undefined' || viewportWidth < DESKTOP_BACK_TO_TOP_BREAKPOINT) {
      return null
    }

    const content = document.getElementById('event-content-main')
    const eventMarkets = document.getElementById('event-markets')
    if (!content || !eventMarkets) {
      return null
    }

    const eventMarketsTop = eventMarkets.getBoundingClientRect().top + scrollY
    if (scrollY < eventMarketsTop - 80) {
      return null
    }

    const rect = content.getBoundingClientRect()
    const boundedWidth = viewportWidth > 0 ? Math.min(rect.width, viewportWidth) : rect.width
    return {
      left: rect.left,
      width: boundedWidth,
    }
  }, [enabled, scrollY, viewportWidth])
}

export default function EventBackToTopButton() {
  const t = useExtracted()
  const isNavigationViewportReady = useNavigationViewportReady()
  const { scrollY, viewportWidth } = useWindowViewport()
  const bounds = useBackToTopBounds({
    enabled: isNavigationViewportReady,
    scrollY,
    viewportWidth,
  })

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!bounds) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed bottom-6 hidden md:flex"
      style={{ left: `${bounds.left}px`, width: `${bounds.width}px` }}
    >
      <div className="grid w-full grid-cols-3 items-center px-4">
        <div />
        <button
          type="button"
          onClick={handleBackToTop}
          className={cn(`
            pointer-events-auto justify-self-center rounded-full border bg-background/90 px-4 py-2 text-sm font-medium
            text-foreground shadow-lg backdrop-blur-sm transition-colors
            hover:text-muted-foreground
          `)}
          aria-label={t('Back to top')}
        >
          <span className="inline-flex items-center gap-2">
            {t('Back to top')}
            <ArrowUpIcon className="size-4" />
          </span>
        </button>
      </div>
    </div>
  )
}
