import type { EventFaqItem } from '@/lib/event-faq'
import StructuredDataScript from '@/components/seo/StructuredDataScript'
import { buildFaqStructuredData } from '@/lib/structured-data'

export default function FaqStructuredData({ items }: { items: EventFaqItem[] }) {
  if (items.length === 0) {
    return null
  }

  return <StructuredDataScript data={buildFaqStructuredData(items)} />
}
