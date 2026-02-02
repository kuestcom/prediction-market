import * as React from 'react'

import { cn } from '@/lib/utils'

function Kbd({ ref, className, ...props }: React.HTMLAttributes<HTMLElement> & { ref?: React.RefObject<HTMLElement | null> }) {
  return (
    <kbd
      ref={ref}
      className={cn(
        `
          pointer-events-none inline-flex h-5 items-center gap-1 rounded-sm border border-muted-foreground/40 bg-muted
          px-1.5 font-mono text-2xs font-medium text-muted-foreground shadow-xs select-none
        `,
        className,
      )}
      {...props}
    />
  )
}
Kbd.displayName = 'Kbd'

export { Kbd }
