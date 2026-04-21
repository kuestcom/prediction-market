'use client'

import type { Event } from '@/types'
import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { buildEventFaqItems } from '@/lib/event-faq'
import { cn } from '@/lib/utils'

interface EventFaqProps {
  event: Event
  commentsCount?: number | null
}

const DEFAULT_VISIBLE_ITEMS = 6

function useEventFaqState(event: Event, siteName: string, commentsCount?: number | null) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [openItemId, setOpenItemId] = useState('')
  const items = useMemo(() => buildEventFaqItems({
    event,
    siteName,
    commentsCount,
  }), [commentsCount, event, siteName])

  return { isExpanded, setIsExpanded, openItemId, setOpenItemId, items }
}

export default function EventFaq({ event, commentsCount }: EventFaqProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const { isExpanded, setIsExpanded, openItemId, setOpenItemId, items } = useEventFaqState(event, site.name, commentsCount)

  const visibleItems = isExpanded
    ? items
    : items.slice(0, DEFAULT_VISIBLE_ITEMS)

  if (items.length === 0) {
    return null
  }

  return (
    <section className="w-full pt-14 sm:pt-16">
      <h2 className="mb-2 text-[16px] font-semibold text-foreground">
        {t('Frequently Asked Questions')}
      </h2>

      <Accordion
        type="single"
        collapsible
        value={openItemId}
        onValueChange={setOpenItemId}
        className="w-full"
      >
        {visibleItems.map(item => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger
              className="
                w-full cursor-pointer py-5 text-[14px] text-foreground
                hover:text-muted-foreground hover:no-underline
                lg:py-6
              "
            >
              {item.question}
            </AccordionTrigger>
            <AccordionContent
              className="text-[14px] leading-relaxed text-foreground [&>div]:pb-5 lg:[&>div]:pb-6"
            >
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {items.length > DEFAULT_VISIBLE_ITEMS && (
        <button
          type="button"
          className={cn(`
            mt-4 flex cursor-pointer items-center gap-2 text-[14px] text-muted-foreground transition-colors
            hover:text-foreground
          `)}
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
