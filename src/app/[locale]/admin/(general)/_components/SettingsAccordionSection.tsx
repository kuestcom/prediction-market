'use client'

import type { ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

interface SettingsAccordionSectionProps {
  value: string
  header: ReactNode
  children: ReactNode
  className?: string
  isOpen: boolean
  onToggle: (value: string) => void
}

function SettingsAccordionSection({
  value,
  header,
  children,
  className,
  isOpen,
  onToggle,
}: SettingsAccordionSectionProps) {
  const contentId = useId()

  return (
    <section
      data-settings-section={value}
      data-state={isOpen ? 'open' : 'closed'}
      className={cn(
        `overflow-hidden rounded-xl border bg-background transition-all duration-500 ease-in-out last:border-b`,
        className,
      )}
    >
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        onClick={() => onToggle(value)}
        className="
          flex h-18 w-full items-center justify-between gap-4 px-4 py-0 text-left transition-colors
          hover:bg-muted/50 hover:no-underline
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
          focus-visible:outline-none
        "
      >
        {header}
        <ChevronDownIcon
          className={cn(
            'size-6 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid min-h-0 transition-[grid-template-rows] duration-200 ease-out',
          isOpen
            ? 'grid-rows-[1fr]'
            : 'grid-rows-[0fr]',
        )}
      >
        <div
          id={contentId}
          aria-hidden={!isOpen}
          className={cn('min-h-0 overflow-hidden', isOpen && 'border-t border-border/30')}
        >
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

export default SettingsAccordionSection
