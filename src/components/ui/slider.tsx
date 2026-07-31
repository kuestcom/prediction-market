'use client'

import type { CSSProperties, ReactNode } from 'react'

import { Slider as SliderPrimitive } from '@base-ui/react/slider'

import { cn } from '@/lib/utils'

interface SliderPartProps {
  controlClassName?: string
  trackClassName?: string
  trackStyle?: CSSProperties
  indicatorClassName?: string
  thumbClassName?: string
  thumbAriaLabel?: string | ((index: number) => string)
  trackChildren?: ReactNode
}

function normalizeSliderValues(value: number | readonly number[] | undefined, fallback: number) {
  if (typeof value === 'number') {
    return [value]
  }

  return value ?? [fallback]
}

function Slider<Value extends number | readonly number[]>({
  className,
  controlClassName,
  trackClassName,
  trackStyle,
  indicatorClassName,
  thumbClassName,
  thumbAriaLabel = 'Slider',
  trackChildren,
  value,
  defaultValue,
  min = 0,
  ...props
}: SliderPrimitive.Root.Props<Value> & SliderPartProps) {
  const values = normalizeSliderValues(value ?? defaultValue, min)
  const getAriaLabel = typeof thumbAriaLabel === 'function' ? thumbAriaLabel : () => thumbAriaLabel

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      min={min}
      thumbAlignment="edge"
      className={cn(
        'relative flex w-full cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className={cn(
          'relative flex w-full grow items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto',
          controlClassName,
        )}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            'relative h-1.5 w-full grow rounded-full bg-primary/20 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
            trackClassName,
          )}
          style={trackStyle}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className={cn(
              'rounded-full bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
              indicatorClassName,
            )}
          />
          {trackChildren}
          {values.map((_, index) => (
            <SliderPrimitive.Thumb
              key={index}
              data-slot="slider-thumb"
              index={index}
              getAriaLabel={getAriaLabel}
              className={cn(
                'relative block size-4 shrink-0 rounded-full border border-primary/50 bg-background shadow transition-colors after:absolute after:-inset-2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring data-disabled:pointer-events-none',
                thumbClassName,
              )}
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
