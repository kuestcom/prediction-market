import type { SQL } from 'drizzle-orm'

import { sql } from 'drizzle-orm'

import type { NonDefaultLocale } from '@/i18n/locales'

export function buildTranslationLocaleSchedulingExpressions(
  localeExpression: SQL<string>,
  locales: NonDefaultLocale[],
) {
  const localePriorityExpression = sql<number>`CASE ${localeExpression} ${sql.join(
    locales.map((locale, index) => sql`WHEN ${locale} THEN CAST(${index} AS bigint)`),
    sql` `,
  )} ELSE CAST(${locales.length} AS bigint) END`
  const localeWeightExpression = sql<number>`CAST(${locales.length} AS bigint) - ${localePriorityExpression}`

  return { localePriorityExpression, localeWeightExpression }
}
