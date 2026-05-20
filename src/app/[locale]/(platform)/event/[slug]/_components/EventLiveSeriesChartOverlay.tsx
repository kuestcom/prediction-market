'use client'

import { ChevronsDownIcon, ChevronsUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TargetLine {
  badgeTop: number
  isAbove: boolean
  isBelow: boolean
}

interface EventLiveSeriesChartOverlayProps {
  targetLine: TargetLine | null
  targetLineGuideColor: string
  targetBadgeColor: string
  currentLineTop: number | null
  currentPriceGuideColor: string
}

export default function EventLiveSeriesChartOverlay({
  targetLine,
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
            className="pointer-events-none absolute right-4 left-0 z-1 h-px sm:right-6"
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
            className="pointer-events-none absolute right-4 z-1 inline-flex -translate-y-1/2 items-center sm:right-6"
            style={{ top: `${targetLine.badgeTop}px` }}
          >
            <span
              aria-hidden
              className="relative z-0 -mr-px inline-block h-3.5 w-2 [clip-path:polygon(0_50%,100%_0,100%_100%)]"
              style={{ backgroundColor: targetBadgeColor }}
            />
            <span
              className={cn(`
                relative z-1 inline-flex items-center gap-0.5 rounded-[4px] px-2 py-1 pl-2 text-xs font-semibold
                text-white
              `)}
              style={{ backgroundColor: targetBadgeColor }}
            >
              <span>Target</span>
              {targetLine.isAbove && <ChevronsUpIcon className="size-3.5 animate-pulse" />}
              {targetLine.isBelow && <ChevronsDownIcon className="size-3.5 animate-pulse" />}
            </span>
          </span>
        </>
      )}
      {currentLineTop != null && (
        <div
          className="pointer-events-none absolute right-4 left-0 z-2 mr-2 h-px sm:right-6"
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
