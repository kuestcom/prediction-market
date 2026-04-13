'use client'

import type { Event } from '@/types'
import { InfoIcon } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface EventCategoryNoteProps {
  event: Event
}

function resolveCategoryNote(event: Event) {
  const tagsWithNotes = event.tags.filter(tag => typeof tag.event_page_note === 'string' && tag.event_page_note.trim().length > 0)
  if (tagsWithNotes.length === 0) {
    return null
  }

  const selectedTag = tagsWithNotes.find(tag => tag.isMainCategory) ?? tagsWithNotes[0]
  const note = selectedTag.event_page_note?.trim()
  if (!note) {
    return null
  }

  return {
    categoryName: selectedTag.name,
    note,
  }
}

export default function EventCategoryNote({ event }: EventCategoryNoteProps) {
  const categoryNote = resolveCategoryNote(event)

  if (!categoryNote) {
    return null
  }

  const title = `Note on ${categoryNote.categoryName} Markets`

  return (
    <section
      id="tag-banner"
      className="mb-6 w-full max-w-full rounded-lg border border-border bg-card text-foreground"
    >
      <div className="hidden p-4 lg:block">
        <p className="text-sm wrap-break-word whitespace-pre-line">
          <span className="font-bold">
            {title}
            {': '}
          </span>
          {categoryNote.note}
        </p>
      </div>

      <div className="lg:hidden">
        <Accordion type="single" collapsible className="border-none">
          <AccordionItem value="event-category-note" className="overflow-hidden border-none">
            <AccordionTrigger className="rounded-md p-4 text-sm font-semibold hover:no-underline">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <InfoIcon className="size-4 shrink-0 text-foreground" />
                <span className="wrap-break-word">{title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="bg-transparent text-sm [&>div]:px-4 [&>div]:pb-4">
              <p className="wrap-break-word whitespace-pre-line">{categoryNote.note}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  )
}
