'use client'

import type { SportsSegmentNumberPickerOption } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useSportsSegmentNumberPicker } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-hooks'
import { cn } from '@/lib/utils'

function SportsSegmentNumberPicker({
  options,
  activeNumber,
  segmentLabel,
  onPick,
}: {
  options: SportsSegmentNumberPickerOption[]
  activeNumber: number | null
  segmentLabel: string
  onPick: (number: number) => void
}) {
  const {
    scrollerRef,
    buttonRefsRef,
    startSpacer,
    endSpacer,
    activeOptionIndex,
    pickOption,
    handlePickPrevious,
    handlePickNext,
  } = useSportsSegmentNumberPicker({ options, activeNumber, onPick })

  if (options.length <= 1) {
    return null
  }

  return (
    <div className="bg-card px-2.5 pb-2">
      <div className="-mx-2.5 border-t border-border/70" />
      <div className="pt-2">
        <div className="mt-0.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePickPrevious}
            disabled={activeOptionIndex <= 0}
            className={cn(
              `
                inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
              `,
              activeOptionIndex > 0
                ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                : 'cursor-not-allowed opacity-40',
            )}
            aria-label={`Previous ${segmentLabel.toLowerCase()}`}
          >
            <ChevronLeftIcon className="size-4.5" />
          </button>

          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="
                pointer-events-none absolute -top-2 left-1/2 h-2 w-3 -translate-x-1/2 bg-primary
                [clip-path:polygon(50%_100%,0_0,100%_0)]
              "
            />

            <div
              ref={scrollerRef}
              className={`
                flex min-w-0 snap-x snap-mandatory scrollbar-none items-center gap-2 overflow-x-auto scroll-smooth
                [&::-webkit-scrollbar]:hidden
              `}
            >
              <span aria-hidden className="shrink-0" style={{ width: startSpacer }} />
              {options.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => pickOption(index)}
                  ref={(node) => {
                    buttonRefsRef.current[option.key] = node
                  }}
                  className={cn(
                    `w-10 shrink-0 snap-center text-center text-sm font-medium text-muted-foreground transition-colors`,
                    index === activeOptionIndex
                      ? 'text-base font-semibold text-foreground'
                      : 'hover:text-foreground/80',
                  )}
                  aria-label={`${segmentLabel} ${option.number}`}
                >
                  {option.label}
                </button>
              ))}
              <span aria-hidden className="shrink-0" style={{ width: endSpacer }} />
            </div>
          </div>

          <button
            type="button"
            onClick={handlePickNext}
            disabled={activeOptionIndex < 0 || activeOptionIndex >= options.length - 1}
            className={cn(
              `
                inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
              `,
              activeOptionIndex >= 0 && activeOptionIndex < options.length - 1
                ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                : 'cursor-not-allowed opacity-40',
            )}
            aria-label={`Next ${segmentLabel.toLowerCase()}`}
          >
            <ChevronRightIcon className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SportsSegmentNumberPicker
