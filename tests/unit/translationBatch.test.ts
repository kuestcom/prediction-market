import { describe, expect, it } from 'vitest'
import {
  assertTranslationUsesExpectedScript,
  groupTranslationsByLocale,
} from '@/lib/translations/batch'

describe('translation batch safety', () => {
  it('isolates provider batches by target locale', () => {
    const batches = groupTranslationsByLocale([
      { id: 'de-1', locale: 'de' as const },
      { id: 'zh-1', locale: 'zh' as const },
      { id: 'de-2', locale: 'de' as const },
      { id: 'ar-1', locale: 'ar' as const },
    ])

    expect(batches.map(batch => batch.map(row => row.id))).toEqual([
      ['de-1', 'de-2'],
      ['zh-1'],
      ['ar-1'],
    ])
  })

  it('rejects Arabic output for a Chinese translation', () => {
    expect(() => assertTranslationUsesExpectedScript({
      locale: 'zh',
      sourceText: 'Kansas City Current vs. Racing Louisville FC',
      translatedText: 'كانساس سيتي كيرنت ضد راسينغ لويسفييل في سي',
    })).toThrow('unexpectedly introduced Arabic script')
  })

  it('accepts the target locale script', () => {
    expect(() => assertTranslationUsesExpectedScript({
      locale: 'ar',
      sourceText: 'Kansas City Current vs. Racing Louisville FC',
      translatedText: 'كانساس سيتي كيرنت ضد راسينغ لويسفييل في سي',
    })).not.toThrow()
  })

  it('allows a non-target script when it was preserved from the source', () => {
    expect(() => assertTranslationUsesExpectedScript({
      locale: 'de',
      sourceText: 'العربية language mention',
      translatedText: 'Erwähnung der العربية Sprache',
    })).not.toThrow()
  })
})
