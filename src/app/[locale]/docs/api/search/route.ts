import { createSearchAPI } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

const pages = source.getPages()

export const { GET } = createSearchAPI('advanced', {
  language: 'english',
  indexes: pages.map(page => ({
    title: page.data.title!,
    description: page.data.description,
    url: page.url,
    id: page.url,
    structuredData: page.data.structuredData,
  })),
})
