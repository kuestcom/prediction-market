import { DEFAULT_LOCALE } from '@/i18n/locales'
import { source } from '@/lib/source'

interface DocsStaticParam {
  slug?: string[]
}

export function getEnglishDocsStaticParams() {
  return source.generateParams()
    .map(({ slug }: DocsStaticParam) => ({
      locale: DEFAULT_LOCALE,
      slug,
    }))
}

export function getEnglishDocsLlmStaticParams() {
  return source.getPages()
    .map(page => page.slugs)
    .map(slug => ({
      locale: DEFAULT_LOCALE,
      slug,
    }))
}
