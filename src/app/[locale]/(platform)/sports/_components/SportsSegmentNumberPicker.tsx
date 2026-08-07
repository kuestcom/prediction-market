'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

import type { SportsSegmentNumberPickerOption } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'

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
  const { activeOptionIndex, pickOption } = useSportsSegmentNumberPicker({
    options,
    activeNumber,
    onPick,
  })
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const activeOptionKey = options[activeOptionIndex]?.key
  const optionKeySignature = options.map((option) => option.key).join('|')

  useLayoutEffect(
    function keepActiveOptionVisible() {
      if (!activeOptionKey) {
        return
      }

      optionRefs.current[activeOptionKey]?.scrollIntoView({ block: 'nearest', inline: 'center' })
    },
    [activeOptionKey, optionKeySignature],
  )

  function pickOptionAtIndex(index: number) {
    const option = options[index]
    if (!option) {
      return
    }

    pickOption(index)
  }

  function handlePickPrevious() {
    if (activeOptionIndex > 0) {
      pickOptionAtIndex(activeOptionIndex - 1)
    }
  }

  function handlePickNext() {
    if (activeOptionIndex >= 0 && activeOptionIndex < options.length - 1) {
      pickOptionAtIndex(activeOptionIndex + 1)
    }
  }

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
              `inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none`,
              activeOptionIndex > 0
                ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                : 'cursor-not-allowed opacity-40',
            )}
            aria-label={`Previous ${segmentLabel.toLowerCase()}`}
          >
            <ChevronLeftIcon className="size-4.5" />
          </button>

          <div className="-my-2 min-w-0 flex-1 scrollbar-none overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-full items-center justify-center gap-1">
              {options.map((option, index) => {
                const isActive = index === activeOptionIndex

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => pickOptionAtIndex(index)}
                    ref={(node) => {
                      optionRefs.current[option.key] = node
                    }}
                    className={cn(
                      `relative flex h-7 min-w-10 items-center justify-center rounded-sm px-2 text-sm font-medium text-muted-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none`,
                      isActive
                        ? 'text-base font-semibold text-foreground'
                        : 'cursor-pointer hover:bg-muted/70 hover:text-foreground/80',
                    )}
                    aria-label={`${segmentLabel} ${option.number}`}
                    aria-pressed={isActive}
                  >
                    {isActive && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-2 left-1/2 h-2 w-3 -translate-x-1/2 bg-primary [clip-path:polygon(50%_100%,0_0,100%_0)]"
                      />
                    )}
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handlePickNext}
            disabled={activeOptionIndex < 0 || activeOptionIndex >= options.length - 1}
            className={cn(
              `inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none`,
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
