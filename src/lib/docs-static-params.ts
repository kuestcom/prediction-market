import { DEFAULT_LOCALE } from '@/i18n/locales'
import { source } from '@/lib/source'

interface DocsStaticParam {
  slug?: string[]
}

export function getEnglishDocsStaticParams() {
  return source.generateParams()
    .filter(({ slug }: DocsStaticParam) => slug?.[0] !== 'api-reference')
    .map(({ slug }: DocsStaticParam) => ({
      locale: DEFAULT_LOCALE,
      slug,
    }))
}

export function getDocsLlmStaticParams() {
  return source.getPages()
    .map(page => page.slugs)
    .map(slug => ({
      slug,
    }))
}
