'use client'

import { useLayoutEffect, useRef } from 'react'

interface TargetLine {
  badgeTop: number
  isAbove: boolean
  isBelow: boolean
}

interface EventLiveSeriesChartOverlayProps {
  targetLine: TargetLine | null
  targetLabel?: string
  targetLineGuideColor: string
  targetBadgeColor: string
  currentLineTop: number | null
  currentPriceGuideColor: string
}

function resolveCanvasColor(canvas: HTMLCanvasElement, color: string) {
  const match = color.match(/^var\((--[^,\s)]+)/)
  if (!match) {
    return color
  }
  return getComputedStyle(canvas).getPropertyValue(match[1]).trim() || '#77808d'
}

function TargetBadgeCanvas({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useLayoutEffect(
    function drawTargetBadge() {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      let context: CanvasRenderingContext2D | null = null
      try {
        context = canvas.getContext('2d')
      } catch {
        return
      }
      if (!context) {
        return
      }

      const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.round(84 * pixelRatio)
      canvas.height = Math.round(18 * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, 84, 18)
      context.beginPath()
      context.moveTo(0, 9)
      context.lineTo(9, 2.2)
      context.bezierCurveTo(10.8, 0.8, 13, 0, 15.3, 0)
      context.lineTo(79, 0)
      context.bezierCurveTo(81.8, 0, 84, 2.2, 84, 5)
      context.lineTo(84, 13)
      context.bezierCurveTo(84, 15.8, 81.8, 18, 79, 18)
      context.lineTo(15.3, 18)
      context.bezierCurveTo(13, 18, 10.8, 17.2, 9, 15.8)
      context.closePath()
      context.fillStyle = resolveCanvasColor(canvas, color)
      context.fill()
    },
    [color],
  )

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
}

function TargetChevronCanvas({ direction }: { direction: 'up' | 'down' }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useLayoutEffect(
    function drawTargetChevrons() {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.round(14 * pixelRatio)
      canvas.height = Math.round(14 * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, 14, 14)
      context.strokeStyle = '#ffffff'
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = 1.8
      context.beginPath()

      const directionSign = direction === 'down' ? 1 : -1
      const firstCenterY = direction === 'down' ? 5 : 4
      const secondCenterY = direction === 'down' ? 9 : 8
      const centerYs = [firstCenterY, secondCenterY]
      centerYs.forEach((centerY) => {
        context.moveTo(2, centerY - directionSign * 2)
        context.lineTo(7, centerY + directionSign * 2)
        context.lineTo(12, centerY - directionSign * 2)
      })
      context.stroke()
    },
    [direction],
  )

  return <canvas ref={canvasRef} aria-hidden className="-mr-1 ml-0.5 size-3.5 animate-pulse" />
}

export default function EventLiveSeriesChartOverlay({
  targetLine,
  targetLabel = 'Target',
  targetLineGuideColor,
  targetBadgeColor,
  currentLineTop,
  currentPriceGuideColor,
}: EventLiveSeriesChartOverlayProps) {
  return (
    <>
      {targetLine && (
        <>
          <div
            className="pointer-events-none absolute right-0 left-0 z-1 h-px"
            style={{
              top: `${targetLine.badgeTop}px`,
              backgroundImage: `repeating-linear-gradient(
                to right,
                ${targetLineGuideColor} 0px,
                ${targetLineGuideColor} 8px,
                transparent 8px,
                transparent 14px
              )`,
            }}
          />
          <span
            className="pointer-events-none absolute right-0 z-1 inline-flex h-[18px] w-[84px] -translate-y-1/2 items-center justify-center"
            style={{ top: `${targetLine.badgeTop}px` }}
          >
            <TargetBadgeCanvas color={targetBadgeColor} />
            <span className="relative z-1 inline-flex items-center gap-0.5 pl-1.5 text-xs leading-none text-white">
              <span>{targetLabel}</span>
              {targetLine.isAbove && <TargetChevronCanvas direction="up" />}
              {targetLine.isBelow && <TargetChevronCanvas direction="down" />}
            </span>
          </span>
        </>
      )}
      {currentLineTop != null && (
        <div
          className="pointer-events-none absolute right-0 left-0 z-2 h-px"
          style={{
            top: `${currentLineTop}px`,
            backgroundImage: `repeating-linear-gradient(
              to right,
              ${currentPriceGuideColor} 0px,
              ${currentPriceGuideColor} 8px,
              transparent 8px,
              transparent 14px
            )`,
          }}
        />
      )}
    </>
  )
}
