import type { SupportedLocale } from '@/i18n/locales'
import type { CategoryFaqContext, CategoryFaqMessageKey } from '@/lib/category-faq'
import { getTranslations } from 'next-intl/server'
import { buildCategoryFaqItems } from '@/lib/category-faq'
import 'server-only'

interface BuildTranslatedCategoryFaqItemsOptions extends CategoryFaqContext {
  locale: SupportedLocale
  siteName: string
}

export async function buildTranslatedCategoryFaqItems({
  locale,
  ...options
}: BuildTranslatedCategoryFaqItemsOptions) {
  const t = await getTranslations({ locale, namespace: 'CategoryFaq' })

  return buildCategoryFaqItems({
    ...options,
    translate: (key: CategoryFaqMessageKey, values) => t(key, values),
  })
}
