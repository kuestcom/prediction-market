import { describe, expect, it } from 'vitest'
import {
  assertTranslationUsesExpectedScript,
  groupTranslationsByLocale,
  resolveDeterministicTranslation,
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

  it.each([
    ['ar', 'Bitcoin صعودًا أم هبوطًا في 27 يوليو؟'],
    ['de', 'Bitcoin am 27. Juli rauf oder runter?'],
    ['es', '¿Bitcoin sube o baja el 27 de julio?'],
    ['fr', 'Bitcoin en hausse ou en baisse le 27 juillet ?'],
    ['it', 'Bitcoin sale o scende il 27 luglio?'],
    ['ja', '7月27日のBitcoinは上がる？下がる？'],
    ['ko', '7월 27일 Bitcoin 상승 또는 하락?'],
    ['pl', 'Bitcoin wzrośnie czy spadnie 27 lipca?'],
    ['pt', 'Bitcoin sobe ou desce em 27 de julho?'],
    ['ru', 'Bitcoin вырастет или упадет 27 июля?'],
    ['zh', '7月27日Bitcoin会上涨还是下跌？'],
  ] as const)('formats dated %s up-or-down titles deterministically', (locale, expected) => {
    expect(resolveDeterministicTranslation({
      locale,
      sourceLabel: 'event title',
      sourceText: 'Bitcoin Up or Down on July 27?',
    })).toBe(expected)
  })

  it('includes the year when the source title includes it', () => {
    expect(resolveDeterministicTranslation({
      locale: 'pt',
      sourceLabel: 'event title',
      sourceText: 'Bitcoin Up or Down on December 1, 2026?',
    })).toBe('Bitcoin sobe ou desce em 1 de dezembro de 2026?')
  })

  it('leaves other title patterns and tag names to the provider', () => {
    expect(resolveDeterministicTranslation({
      locale: 'pt',
      sourceLabel: 'event title',
      sourceText: 'Will Bitcoin reach $200k?',
    })).toBeNull()
    expect(resolveDeterministicTranslation({
      locale: 'pt',
      sourceLabel: 'tag name',
      sourceText: 'Bitcoin Up or Down on July 27?',
    })).toBeNull()
  })
})
