import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EventMarketRowShellProps {
  children: ReactNode
  isExpanded: boolean
  onToggle: () => void
}

export default function EventMarketRowShell({
  children,
  isExpanded,
  onToggle,
}: EventMarketRowShellProps) {
  return (
    <div
      className={cn(
        `
          group relative z-0 flex w-full cursor-pointer flex-col items-start py-3 pr-2 pl-4 transition-all duration-200
          ease-in-out
          before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-lg
          before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 before:content-['']
          hover:before:opacity-100
          lg:flex-row lg:items-center lg:rounded-lg lg:px-0
          dark:before:bg-white/5
        `,
      )}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      {children}
    </div>
  )
}
