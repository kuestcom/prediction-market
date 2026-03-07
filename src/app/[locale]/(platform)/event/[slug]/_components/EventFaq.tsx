'use client'

import type { Event } from '@/types'
import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { buildEventFaqItems } from '@/lib/event-faq'
import { cn } from '@/lib/utils'

interface EventFaqProps {
  event: Event
  commentsCount?: number | null
}

const DEFAULT_VISIBLE_ITEMS = 6

export default function EventFaq({ event, commentsCount }: EventFaqProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const baseId = useId()
  const [isExpanded, setIsExpanded] = useState(false)
  const [openItemIds, setOpenItemIds] = useState<Set<string>>(() => new Set())

  const items = useMemo(() => buildEventFaqItems({
    event,
    siteName: site.name,
    commentsCount,
  }), [commentsCount, event, site.name])

  const visibleItems = isExpanded
    ? items
    : items.slice(0, DEFAULT_VISIBLE_ITEMS)

  function handleItemToggle(itemId: string) {
    setOpenItemIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      }
      else {
        next.add(itemId)
      }
      return next
    })
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section className="w-full pt-8">
      <h2 className="mb-2 text-[16px] font-semibold text-foreground">
        {t('Frequently Asked Questions')}
      </h2>

      <div className="w-full">
        {visibleItems.map((item) => {
          const itemBaseId = `${baseId}-${item.id}`
          const triggerId = `${itemBaseId}-trigger`
          const contentId = `${itemBaseId}-content`
          const itemOpen = openItemIds.has(item.id)

          return (
            <div key={item.id} className="border-b border-border last:border-b-0">
              <h3>
                <button
                  type="button"
                  aria-controls={contentId}
                  aria-expanded={itemOpen}
                  id={triggerId}
                  className="
                    group flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-[14px]
                    text-foreground transition-colors
                    hover:text-muted-foreground
                    lg:py-6
                  "
                  onClick={() => handleItemToggle(item.id)}
                >
                  <span>{item.question}</span>
                  <ChevronDownIcon
                    className={cn(
                      'ml-4 size-4 shrink-0 transition-transform duration-200',
                      itemOpen && 'rotate-180',
                    )}
                  />
                </button>
              </h3>

              <div
                id={contentId}
                role="region"
                aria-labelledby={triggerId}
                className={cn(
                  'overflow-hidden transition-all duration-200 ease-out',
                  itemOpen ? 'max-h-160 opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className="pb-5 text-[14px] leading-relaxed text-foreground lg:pb-6">
                  {item.answer}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {items.length > DEFAULT_VISIBLE_ITEMS && (
        <button
          type="button"
          className="
            mt-4 flex cursor-pointer items-center gap-2 text-[14px] text-muted-foreground transition-colors
            hover:text-foreground
          "
          onClick={() => setIsExpanded(current => !current)}
        >
          <span>{isExpanded ? t('View less') : t('View more')}</span>
          <ChevronDownIcon
            className={cn(
              'size-3 transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
          />
        </button>
      )}
    </section>
  )
}
