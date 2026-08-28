import { sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { buildTranslationLocaleSchedulingExpressions } from '@/lib/translations/scheduling'

describe('translation locale scheduling', () => {
  it('casts generated priority values before bigint arithmetic', () => {
    const localeExpression = sql<string>`split_part(${'event:pt'}, ':', 2)`
    const { localeWeightExpression } = buildTranslationLocaleSchedulingExpressions(localeExpression, ['pt', 'fr'])
    const query = new PgDialect().sqlToQuery(localeWeightExpression)

    expect(query.sql).toMatch(/^CAST\(\$1 AS bigint\) - CASE/)
    expect(query.sql.match(/THEN CAST\(\$\d+ AS bigint\)/g)).toHaveLength(2)
    expect(query.sql).toMatch(/ELSE CAST\(\$\d+ AS bigint\) END$/)
  })
})
