import { describe, expect, it } from 'bun:test'

import {
  assertTranslationUsesExpectedScript,
  groupTranslationsByLocale,
  resolveDeterministicTranslation,
  resolveDeterministicTranslationVersion,
  resolveTranslationSourceFingerprint,
} from '@/lib/translations/batch'

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
}

describe('translation batch safety', () => {
  it('isolates provider batches by target locale', () => {
    const batches = groupTranslationsByLocale([
      { id: 'de-1', locale: 'de' as const },
      { id: 'zh-1', locale: 'zh' as const },
      { id: 'de-2', locale: 'de' as const },
      { id: 'ar-1', locale: 'ar' as const },
    ])

    expect(batches.map((batch) => batch.map((row) => row.id))).toEqual([['de-1', 'de-2'], ['zh-1'], ['ar-1']])
  })

  it('rejects Arabic output for a Chinese translation', () => {
    expect(() =>
      assertTranslationUsesExpectedScript({
        locale: 'zh',
        sourceText: 'Kansas City Current vs. Racing Louisville FC',
        translatedText: 'كانساس سيتي كيرنت ضد راسينغ لويسفييل في سي',
      }),
    ).toThrow('unexpectedly introduced Arabic script')
  })

  it('accepts the target locale script', () => {
    expect(() =>
      assertTranslationUsesExpectedScript({
        locale: 'ar',
        sourceText: 'Kansas City Current vs. Racing Louisville FC',
        translatedText: 'كانساس سيتي كيرنت ضد راسينغ لويسفييل في سي',
      }),
    ).not.toThrow()
  })

  it('allows a non-target script when it was preserved from the source', () => {
    expect(() =>
      assertTranslationUsesExpectedScript({
        locale: 'de',
        sourceText: 'العربية language mention',
        translatedText: 'Erwähnung der العربية Sprache',
      }),
    ).not.toThrow()
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
    expect(
      resolveDeterministicTranslation({
        locale,
        sourceLabel: 'event title',
        sourceText: 'Bitcoin Up or Down on July 27?',
      }),
    ).toBe(expected)
  })

  it('includes the year when the source title includes it', () => {
    expect(
      resolveDeterministicTranslation({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Bitcoin Up or Down on December 1, 2026?',
      }),
    ).toBe('Bitcoin sobe ou desce em 1 de dezembro de 2026?')
  })

  it.each([
    ['ar', 'تأييد ترامب صعودًا أم هبوطًا هذا الأسبوع؟'],
    ['de', 'Trump-Zustimmung diese Woche rauf oder runter?'],
    ['es', '¿Aprobación de Trump sube o baja esta semana?'],
    ['fr', 'Approbation de Trump en hausse ou en baisse cette semaine ?'],
    ['it', 'Approvazione di Trump sale o scende questa settimana?'],
    ['ja', '今週のトランプ支持率は上がる？下がる？'],
    ['ko', '이번 주 트럼프 지지율 상승 또는 하락?'],
    ['pl', 'Poparcie dla Trumpa wzrośnie czy spadnie w tym tygodniu?'],
    ['pt', 'Aprovação de Trump sobe ou desce esta semana?'],
    ['ru', 'Одобрение Трампа вырастет или упадет на этой неделе?'],
    ['zh', '本周特朗普支持率会上涨还是下跌？'],
  ] as const)('formats weekly %s up-or-down titles deterministically', (locale, expected) => {
    expect(
      resolveDeterministicTranslation({
        locale,
        sourceLabel: 'event title',
        sourceText: 'Trump approval Up or Down this week?',
      }),
    ).toBe(expected)
  })

  it.each(['WTI Crude Oil (WTI)', 'Gold (XAUUSD)'])('accepts non-crypto dated subjects such as %s', (subject) => {
    expect(
      resolveDeterministicTranslation({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: `${subject} Up or Down on July 31?`,
      }),
    ).toBe(`${subject} sobe ou desce em 31 de julho?`)
  })

  it.each([
    ['ar', 'Bitcoin صعودًا أم هبوطًا — 28 يوليو، 8:15 ص ET'],
    ['de', 'Bitcoin rauf oder runter — 28. Juli, 8:15 ET'],
    ['es', 'Bitcoin sube o baja — 28 de julio, 8:15 ET'],
    ['fr', 'Bitcoin en hausse ou en baisse — 28 juillet, 8:15 ET'],
    ['it', 'Bitcoin sale o scende — 28 luglio, 8:15 ET'],
    ['ja', 'Bitcoinは上がる？下がる？ — 7月28日 8:15 ET'],
    ['ko', 'Bitcoin 상승 또는 하락 — 7월 28일 오전 8:15 ET'],
    ['pl', 'Bitcoin wzrośnie czy spadnie — 28 lipca, 8:15 ET'],
    ['pt', 'Bitcoin sobe ou desce — 28 de julho, 8:15 ET'],
    ['ru', 'Bitcoin вырастет или упадет — 28 июля, 8:15 ET'],
    ['zh', 'Bitcoin会上涨还是下跌 — 7月28日 8:15 ET'],
  ] as const)('formats timed %s up-or-down titles deterministically', (locale, expected) => {
    expect(
      normalizeWhitespace(
        resolveDeterministicTranslation({
          locale,
          sourceLabel: 'event title',
          sourceText: 'Bitcoin Up or Down - July 28, 8:15AM ET',
        }),
      ),
    ).toBe(normalizeWhitespace(expected))
  })

  it.each([
    ['pt', 'Bitcoin sobe ou desce — 2 de agosto, 16:00–20:00 ET'],
    ['de', 'Bitcoin rauf oder runter — 2. August, 20:00–0:00 ET'],
  ] as const)('formats ranged %s up-or-down titles deterministically', (locale, expected) => {
    const sourceText =
      locale === 'de'
        ? 'Bitcoin Up or Down - August 2, 8:00PM-12:00AM ET'
        : 'Bitcoin Up or Down - August 2, 4:00PM-8:00PM ET'

    expect(
      resolveDeterministicTranslation({
        locale,
        sourceLabel: 'event title',
        sourceText,
      }),
    ).toBe(expected)
  })

  it.each([
    ['Bitcoin Up or Down - August 2, 11:00PM-1:00AM ET', 'Bitcoin sobe ou desce — 2 de agosto, 23:00–1:00 ET'],
    ['Bitcoin Up or Down - August 2, 8PM-12AM ET', 'Bitcoin sobe ou desce — 2 de agosto, 20:00–0:00 ET'],
  ])('handles ranged rollover and optional minutes in %s', (sourceText, expected) => {
    expect(
      resolveDeterministicTranslation({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText,
      }),
    ).toBe(expected)
  })

  it('versions deterministic titles so existing automatic translations are refreshed', () => {
    expect(
      resolveDeterministicTranslationVersion({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Bitcoin Up or Down - July 28, 8AM ET',
      }),
    ).toBe('up-or-down-v3')
    expect(
      resolveDeterministicTranslationVersion({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Will Bitcoin reach $200k?',
      }),
    ).toBeNull()
    expect(
      resolveTranslationSourceFingerprint({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Bitcoin Up or Down - July 28, 8AM ET',
      }),
    ).toBe('Bitcoin Up or Down - July 28, 8AM ET\0up-or-down-v3')
    expect(
      resolveTranslationSourceFingerprint({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Trump approval Up or Down this week?',
      }),
    ).toBe('Trump approval Up or Down this week?\0up-or-down-weekly-v2')
    expect(
      resolveTranslationSourceFingerprint({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Bitcoin Up or Down - August 2, 4:00PM-8:00PM ET',
      }),
    ).toBe('Bitcoin Up or Down - August 2, 4:00PM-8:00PM ET\0up-or-down-range-v2')
  })

  it('leaves other title patterns and tag names to the provider', () => {
    expect(
      resolveDeterministicTranslation({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Will Bitcoin reach $200k?',
      }),
    ).toBeNull()
    expect(
      resolveDeterministicTranslation({
        locale: 'pt',
        sourceLabel: 'tag name',
        sourceText: 'Bitcoin Up or Down on July 27?',
      }),
    ).toBeNull()
    expect(
      resolveDeterministicTranslation({
        locale: 'pt',
        sourceLabel: 'event title',
        sourceText: 'Bitcoin Up or Down - February 30, 8AM ET',
      }),
    ).toBeNull()
  })
})
