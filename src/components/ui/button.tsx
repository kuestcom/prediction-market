import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { Slot as SlotPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  `
    inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-sm font-medium whitespace-nowrap
    transition-all outline-none
    focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
    disabled:pointer-events-none disabled:opacity-50
    aria-invalid:border-destructive aria-invalid:ring-destructive/20
    dark:aria-invalid:ring-destructive/40
    [&_svg]:pointer-events-none [&_svg]:shrink-0
    [&_svg:not([class*='size-'])]:size-4
  `,
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          `
            bg-destructive text-white shadow-xs
            hover:bg-destructive/90
            focus-visible:ring-destructive/20
            dark:bg-destructive/60
            dark:focus-visible:ring-destructive/40
          `,
        outline:
          `
            border bg-background shadow-xs
            hover:bg-accent hover:text-accent-foreground
            dark:border-input dark:bg-input/30
            dark:hover:bg-input/50
          `,
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
        yes: `
          bg-yes/15 font-semibold text-yes-foreground transition-colors
          hover:bg-yes-foreground hover:text-white
          dark:hover:bg-yes dark:hover:text-white
        `,
        no: `
          bg-no/15 font-semibold text-no-foreground transition-colors
          hover:bg-no-foreground hover:text-white
          dark:hover:bg-no dark:hover:text-white
        `,
      },
      size: {
        outcome: 'h-[40px] min-w-0 flex-1 gap-1 px-3',
        outcomeLg: 'h-[48px] min-w-0 flex-1 gap-1 px-3',
        header: 'h-10 px-4 py-2 has-[>svg]:px-3',
        headerCompact: 'h-9 px-4 py-2 has-[>svg]:px-3',
        headerIcon: 'size-10',
        headerIconCompact: 'size-9',
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'>
  & VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
