import { describe, expect, it } from 'vitest'
import { buildFaqStructuredData } from '@/lib/structured-data'

describe('buildFaqStructuredData', () => {
  it('maps FAQ items to schema.org FAQPage entities', () => {
    expect(buildFaqStructuredData([{
      id: 'faq-1',
      question: 'Question?',
      answer: 'Answer.',
    }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [{
        '@type': 'Question',
        'name': 'Question?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Answer.',
        },
      }],
    })
  })
})
