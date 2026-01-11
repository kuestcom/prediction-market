import type { TimeRange } from '@/app/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { ShuffleIcon } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface EventChartControlsProps {
  hasChartData: boolean
  timeRanges: TimeRange[]
  activeTimeRange: TimeRange
  onTimeRangeChange: (value: TimeRange) => void
  showOutcomeSwitch: boolean
  oppositeOutcomeLabel: string
  onShuffle: () => void
}

export default function EventChartControls({
  hasChartData,
  timeRanges,
  activeTimeRange,
  onTimeRangeChange,
  showOutcomeSwitch,
  oppositeOutcomeLabel,
  onShuffle,
}: EventChartControlsProps) {
  const timeRangeContainerRef = useRef<HTMLDivElement | null>(null)
  const timeRangeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [timeRangeIndicator, setTimeRangeIndicator] = useState({ width: 0, left: 0 })
  const [timeRangeIndicatorReady, setTimeRangeIndicatorReady] = useState(false)

  const updateIndicator = useCallback(() => {
    if (!hasChartData) {
      return
    }
    const activeIndex = timeRanges.findIndex(range => range === activeTimeRange)
    if (activeIndex < 0) {
      return
    }
    const activeButton = timeRangeRefs.current[activeIndex]

    if (!activeButton) {
      return
    }

    const { offsetLeft, offsetWidth } = activeButton

    queueMicrotask(() => {
      setTimeRangeIndicator({ left: offsetLeft, width: offsetWidth })
      setTimeRangeIndicatorReady(true)
    })
  }, [activeTimeRange, hasChartData, timeRanges])

  useLayoutEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  useEffect(() => {
    if (!hasChartData) {
      return
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [hasChartData, updateIndicator])

  if (!hasChartData) {
    return null
  }

  return (
    <div className="relative mt-3 flex flex-wrap items-center justify-between gap-3">
      <div
        ref={timeRangeContainerRef}
        className="relative flex flex-wrap items-center justify-start gap-2 text-xs font-semibold"
      >
        <div
          className={cn(
            'absolute inset-y-0 rounded-md bg-muted',
            timeRangeIndicatorReady ? 'opacity-100 transition-all duration-300' : 'opacity-0 transition-none',
          )}
          style={{
            width: `${timeRangeIndicator.width}px`,
            left: `${timeRangeIndicator.left}px`,
          }}
          aria-hidden={!timeRangeIndicatorReady}
        />
        {timeRanges.map((range, index) => (
          <button
            key={range}
            type="button"
            ref={(el) => {
              timeRangeRefs.current[index] = el
            }}
            className={cn(
              'relative rounded-md px-3 py-2 transition-colors',
              activeTimeRange === range
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
            data-range={range}
            onClick={() => onTimeRangeChange(range)}
          >
            {range}
          </button>
        ))}
      </div>

      {showOutcomeSwitch && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={
                `
                  flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground
                  transition-colors
                  hover:bg-muted/70 hover:text-foreground
                `
              }
              onClick={onShuffle}
              aria-label={`Switch to ${oppositeOutcomeLabel}`}
            >
              <ShuffleIcon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            sideOffset={8}
            hideArrow
            className="border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-xl"
          >
            Switch to
            {' '}
            {oppositeOutcomeLabel}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
