import type { EventFaqItem } from '@/lib/event-faq'
import StructuredDataScript from '@/components/seo/StructuredDataScript'

export function buildFaqStructuredData(items: EventFaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': items.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': item.answer,
      },
    })),
  }
}

export default function FaqStructuredData({ items }: { items: EventFaqItem[] }) {
  if (items.length === 0) {
    return null
  }

  return <StructuredDataScript data={buildFaqStructuredData(items)} />
}
