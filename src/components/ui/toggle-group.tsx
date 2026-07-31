'use client'

import type { VariantProps } from 'class-variance-authority'
import type { CSSProperties } from 'react'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { createContext, useContext } from 'react'

import { toggleVariants } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

interface ToggleGroupStyleProps extends VariantProps<typeof toggleVariants> {
  spacing?: number
}

const ToggleGroupContext = createContext<ToggleGroupStyleProps>({
  size: 'default',
  variant: 'default',
  spacing: 1,
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 1,
  children,
  ...props
}: ToggleGroupPrimitive.Props & ToggleGroupStyleProps) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      style={{ '--toggle-group-gap': spacing } as CSSProperties}
      className={cn(
        `group/toggle-group flex items-center justify-center gap-[--spacing(var(--toggle-group-gap))] data-vertical:flex-col data-vertical:items-stretch`,
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        'shrink-0 group-data-[spacing=0]/toggle-group:rounded-none focus:z-10 focus-visible:z-10',
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
