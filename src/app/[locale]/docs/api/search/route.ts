import { createSearchAPI } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

const pages = JSON.parse(process.env.FORK_OWNER_GUIDE || 'false')
  ? source.getPages()
  : source.getPages().filter(page => !page.url.includes('/owners'))

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
