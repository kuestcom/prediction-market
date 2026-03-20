import { DEFAULT_LOCALE } from '@/i18n/locales'
import { source } from '@/lib/source'

interface DocsStaticParam {
  slug?: string[]
}

export function isLaunchGuideEnabled() {
  return process.env.ENABLE_LAUNCH_GUIDE === 'true'
}

export function getEnglishDocsStaticParams() {
  return source.generateParams()
    .map(({ slug }: DocsStaticParam) => ({
      locale: DEFAULT_LOCALE,
      slug,
    }))
    .filter(param => isLaunchGuideEnabled() || param.slug?.[0] !== 'launch')
}

export function getEnglishDocsLlmStaticParams() {
  return source.getPages()
    .map(page => page.slugs)
    .filter(slug => isLaunchGuideEnabled() || slug[0] !== 'launch')
    .map(slug => ({
      locale: DEFAULT_LOCALE,
      slug,
    }))
}
