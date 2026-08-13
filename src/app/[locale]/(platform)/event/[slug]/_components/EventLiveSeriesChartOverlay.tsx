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
            <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 84 18" preserveAspectRatio="none">
              <path
                d="M0 9L9 2.2C10.8 0.8 13 0 15.3 0H79C81.8 0 84 2.2 84 5V13C84 15.8 81.8 18 79 18H15.3C13 18 10.8 17.2 9 15.8L0 9Z"
                fill={targetBadgeColor}
              />
            </svg>
            <span
              className={cn(`relative z-1 inline-flex items-center gap-0.5 pl-1.5 text-xs leading-none text-white`)}
            >
              <span>Target</span>
              {targetLine.isAbove && <ChevronsUpIcon className="-mr-2 h-4 w-5 scale-x-[1.2] animate-pulse" />}
              {targetLine.isBelow && <ChevronsDownIcon className="-mr-2 h-4 w-5 scale-x-[1.2] animate-pulse" />}
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
