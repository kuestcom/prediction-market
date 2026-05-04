'use client'

import type { RefObject } from 'react'
import { ExternalLinkIcon, GripVerticalIcon, RadioIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { resolveLivestreamEmbedTarget } from '@/lib/livestream-embed'
import { useSportsLivestream } from '@/stores/useSportsLivestream'

const MIN_PLAYER_WIDTH = 280
const DEFAULT_PLAYER_WIDTH = 420

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}

function subscribeToViewportWidth(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange)
  return () => {
    window.removeEventListener('resize', onStoreChange)
  }
}

function getViewportWidthSnapshot() {
  return window.innerWidth
}

function getViewportWidthServerSnapshot() {
  return 0
}

function useResizablePlayerWidth(): {
  effectiveWidth: number
  minWidth: number
  maxWidth: number
  setRequestedWidth: (value: number) => void
  dragCleanupRef: RefObject<(() => void) | null>
} {
  const viewportWidth = useSyncExternalStore(
    subscribeToViewportWidth,
    getViewportWidthSnapshot,
    getViewportWidthServerSnapshot,
  )
  const [requestedWidth, setRequestedWidth] = useState(DEFAULT_PLAYER_WIDTH)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  const maxWidth = useMemo(() => {
    if (viewportWidth <= 0) {
      return 688
    }

    if (viewportWidth < 768) {
      return Math.max(300, viewportWidth - 24)
    }

    const viewportCap = Math.max(448, viewportWidth - 24)
    return Math.max(448, Math.min(viewportCap, Math.floor(viewportWidth * 0.56)))
  }, [viewportWidth])

  const minWidth = useMemo(() => {
    if (viewportWidth <= 0) {
      return MIN_PLAYER_WIDTH
    }
    return viewportWidth < 768 ? Math.min(300, Math.max(240, viewportWidth - 24)) : MIN_PLAYER_WIDTH
  }, [viewportWidth])

  const effectiveWidth = useMemo(() => clamp(requestedWidth, minWidth, maxWidth), [maxWidth, minWidth, requestedWidth])

  useEffect(function cleanupDragListenersOnUnmount() {
    const cleanupRef = dragCleanupRef
    return function runDragCleanupOnUnmount() {
      cleanupRef.current?.()
    }
  }, [])

  return { effectiveWidth, minWidth, maxWidth, setRequestedWidth, dragCleanupRef }
}

function useLivestreamEmbedTarget(streamUrl: string | null) {
  return useMemo(() => {
    if (!streamUrl) {
      return null
    }
    const parentDomain = typeof window !== 'undefined' ? window.location.hostname : null
    return resolveLivestreamEmbedTarget(streamUrl, { parentDomain })
  }, [streamUrl])
}

export default function SportsLivestreamFloatingPlayer() {
  const streamUrl = useSportsLivestream(state => state.streamUrl)
  const streamTitle = useSportsLivestream(state => state.streamTitle)
  const closeStream = useSportsLivestream(state => state.closeStream)
  const { effectiveWidth, minWidth, maxWidth, setRequestedWidth, dragCleanupRef } = useResizablePlayerWidth()
  const embedTarget = useLivestreamEmbedTarget(streamUrl)

  if (!streamUrl || !embedTarget) {
    return null
  }

  return (
    <div
      className={`
        fixed right-3 bottom-3 z-55 overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/40
        md:right-4 md:bottom-4
      `}
      style={{ width: `${effectiveWidth}px` }}
    >
      <div className="group/stream-header relative flex items-center gap-2 border-b bg-secondary/40 px-2.5 py-2">
        <button
          type="button"
          aria-label="Resize stream player"
          onPointerDown={(event) => {
            event.preventDefault()
            const startX = event.clientX
            const startY = event.clientY
            const startWidth = effectiveWidth

            function stopResize() {
              window.removeEventListener('pointermove', handlePointerMove)
              window.removeEventListener('pointerup', stopResize)
              dragCleanupRef.current = null
            }

            function handlePointerMove(pointerEvent: PointerEvent) {
              const deltaX = startX - pointerEvent.clientX
              const deltaY = (startY - pointerEvent.clientY) * (16 / 9)
              const nextWidth = startWidth + Math.max(deltaX, deltaY)
              setRequestedWidth(clamp(nextWidth, minWidth, maxWidth))
            }

            dragCleanupRef.current?.()
            window.addEventListener('pointermove', handlePointerMove)
            window.addEventListener('pointerup', stopResize)
            dragCleanupRef.current = stopResize
          }}
          className={`
            absolute top-0 left-0 z-10 size-6 cursor-nwse-resize bg-linear-to-br from-border/90 via-border/35
            to-transparent
          `}
        >
          <GripVerticalIcon
            className={`
              pointer-events-none absolute top-0.5 left-0.5 size-3 rotate-45 text-muted-foreground/70 opacity-0
              transition-all
              group-hover/stream-header:text-foreground/80 group-hover/stream-header:opacity-100
            `}
          />
        </button>

        <RadioIcon className="size-3.5 shrink-0 text-red-500" />
        <p className="min-w-0 truncate text-xs font-semibold text-foreground">
          {streamTitle || 'Livestream'}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              dragCleanupRef.current?.()
              closeStream()
            }}
            className={`
              inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors
              hover:bg-muted/80 hover:text-foreground
            `}
            aria-label="Close stream"
            title="Close stream"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {embedTarget.embedUrl
        ? (
            <div className="relative aspect-video bg-black/90">
              <iframe
                src={embedTarget.embedUrl}
                title={streamTitle || 'Livestream'}
                className="absolute inset-0 size-full"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )
        : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
              <p className="text-sm text-white/85">
                This stream provider does not support direct embedding here.
              </p>
              <a
                href={embedTarget.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white
                  transition-colors
                  hover:bg-white/20
                "
              >
                <ExternalLinkIcon className="size-3.5" />
                Open stream
              </a>
            </div>
          )}

    </div>
  )
}
