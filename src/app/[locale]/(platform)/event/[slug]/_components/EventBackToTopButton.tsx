'use client'

import { ArrowUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const BACK_TO_TOP_SCROLL_THRESHOLD = 400

function subscribeScroll(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('scroll', onStoreChange, { passive: true })
  return function unsubscribeScroll() {
    window.removeEventListener('scroll', onStoreChange)
  }
}

function getScrollSnapshot() {
  if (typeof window === 'undefined') {
    return 0
  }

  return window.scrollY
}

function useWindowScrollY() {
  return useSyncExternalStore(subscribeScroll, getScrollSnapshot, () => 0)
}

export default function EventBackToTopButton() {
  const t = useExtracted()
  const scrollY = useWindowScrollY()

  if (scrollY < BACK_TO_TOP_SCROLL_THRESHOLD) {
    return null
  }

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 hidden justify-center md:flex">
      <button
        type="button"
        onClick={handleBackToTop}
        className={cn(`
          pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-background/90 px-4 py-2 text-sm
          font-medium text-foreground shadow-lg backdrop-blur-sm transition-colors
          hover:text-muted-foreground
        `)}
        aria-label={t('Back to top')}
      >
        {t('Back to top')}
        <ArrowUpIcon className="size-4" />
      </button>
    </div>
  )
}
