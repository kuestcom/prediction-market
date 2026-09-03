import { sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import type { SupportedLocale } from '@/i18n/locales'
import type { TermsOfServiceTranslations, TermsOfServiceTranslationsPatch } from '@/lib/terms-of-service'
import type { QueryResult } from '@/types'

import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { hasDatabaseEnv } from '@/lib/db/env'
import { terms_of_service_translations } from '@/lib/db/schema/legal/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

type TermsOfServiceTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

function createEmptyTermsOfServiceTranslations(): TermsOfServiceTranslations {
  return Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, ''])) as TermsOfServiceTranslations
}

function getTranslationValues(translations: TermsOfServiceTranslationsPatch) {
  return SUPPORTED_LOCALES.flatMap((locale) => {
    const content = translations[locale]
    return typeof content === 'string' ? [{ locale, content }] : []
  })
}

export async function upsertTermsOfServiceTranslationsInTransaction(
  tx: TermsOfServiceTransaction,
  translations: TermsOfServiceTranslationsPatch,
) {
  const values = getTranslationValues(translations)
  if (values.length === 0) {
    return []
  }

  const now = new Date()
  return tx
    .insert(terms_of_service_translations)
    .values(values)
    .onConflictDoUpdate({
      target: terms_of_service_translations.locale,
      set: {
        content: sql`EXCLUDED.content`,
        updated_at: now,
      },
    })
    .returning()
}

async function getCachedTranslations(): Promise<QueryResult<TermsOfServiceTranslations>> {
  'use cache'
  cacheLife('default')
  cacheTag(cacheTags.termsOfService)

  return runQuery(async () => {
    try {
      const rows = await db
        .select({
          locale: terms_of_service_translations.locale,
          content: terms_of_service_translations.content,
        })
        .from(terms_of_service_translations)

      const translations = createEmptyTermsOfServiceTranslations()
      for (const row of rows) {
        if (SUPPORTED_LOCALES.includes(row.locale as SupportedLocale)) {
          translations[row.locale as SupportedLocale] = row.content
        }
      }

      return { data: translations, error: null }
    } catch {
      return { data: null, error: 'Failed to fetch Terms of Use translations.' }
    }
  })
}

export const TermsOfServiceRepository = {
  async getTranslations(): Promise<QueryResult<TermsOfServiceTranslations>> {
    if (!hasDatabaseEnv()) {
      return { data: null, error: 'Database env vars are not configured.' }
    }

    return getCachedTranslations()
  },
}
