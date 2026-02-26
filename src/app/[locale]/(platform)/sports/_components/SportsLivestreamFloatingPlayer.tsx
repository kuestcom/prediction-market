'use client'

import { ExternalLinkIcon, GripVerticalIcon, RadioIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

export default function SportsLivestreamFloatingPlayer() {
  const streamUrl = useSportsLivestream(state => state.streamUrl)
  const streamTitle = useSportsLivestream(state => state.streamTitle)
  const closeStream = useSportsLivestream(state => state.closeStream)
  const [viewportWidth, setViewportWidth] = useState<number>(0)
  const [playerWidth, setPlayerWidth] = useState(DEFAULT_PLAYER_WIDTH)
  const [resizeSession, setResizeSession] = useState<{ startX: number, startY: number, startWidth: number } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    function updateViewport() {
      setViewportWidth(window.innerWidth)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => {
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

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

  const effectiveWidth = useMemo(() => clamp(playerWidth, minWidth, maxWidth), [maxWidth, minWidth, playerWidth])

  useEffect(() => {
    if (!streamUrl) {
      setResizeSession(null)
      return
    }

    setPlayerWidth(current => clamp(current || DEFAULT_PLAYER_WIDTH, minWidth, maxWidth))
  }, [maxWidth, minWidth, streamUrl])

  useEffect(() => {
    if (!resizeSession) {
      return
    }
    const session = resizeSession

    function handlePointerMove(event: PointerEvent) {
      const deltaX = session.startX - event.clientX
      const deltaY = (session.startY - event.clientY) * (16 / 9)
      const nextWidth = session.startWidth + Math.max(deltaX, deltaY)
      setPlayerWidth(clamp(nextWidth, minWidth, maxWidth))
    }

    function handlePointerUp() {
      setResizeSession(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [maxWidth, minWidth, resizeSession])

  const embedTarget = useMemo(() => {
    if (!streamUrl) {
      return null
    }
    const parentDomain = typeof window !== 'undefined' ? window.location.hostname : null
    return resolveLivestreamEmbedTarget(streamUrl, { parentDomain })
  }, [streamUrl])

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
            setResizeSession({ startX: event.clientX, startY: event.clientY, startWidth: effectiveWidth })
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
            onClick={closeStream}
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
