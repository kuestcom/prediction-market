import type { NonDefaultLocale } from '@/i18n/locales'

interface TranslationLocaleRow {
  locale: NonDefaultLocale
}

interface TranslationScriptRule {
  allowedLocales: readonly NonDefaultLocale[]
  label: string
  pattern: RegExp
}

const TRANSLATION_SCRIPT_RULES: TranslationScriptRule[] = [
  { allowedLocales: ['ar'], label: 'Arabic', pattern: /\p{Script=Arabic}/u },
  { allowedLocales: ['ru'], label: 'Cyrillic', pattern: /\p{Script=Cyrillic}/u },
  { allowedLocales: ['ko'], label: 'Hangul', pattern: /\p{Script=Hangul}/u },
  { allowedLocales: ['ja'], label: 'Japanese kana', pattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/u },
  { allowedLocales: ['zh', 'ja'], label: 'Han', pattern: /\p{Script=Han}/u },
]

export function groupTranslationsByLocale<T extends TranslationLocaleRow>(rows: readonly T[]) {
  const rowsByLocale = new Map<NonDefaultLocale, T[]>()

  for (const row of rows) {
    const localeRows = rowsByLocale.get(row.locale) ?? []
    localeRows.push(row)
    rowsByLocale.set(row.locale, localeRows)
  }

  return Array.from(rowsByLocale.values())
}

export function assertTranslationUsesExpectedScript(input: {
  locale: NonDefaultLocale
  sourceText: string
  translatedText: string
}) {
  for (const rule of TRANSLATION_SCRIPT_RULES) {
    if (
      rule.allowedLocales.includes(input.locale)
      || !rule.pattern.test(input.translatedText)
      || rule.pattern.test(input.sourceText)
    ) {
      continue
    }

    throw new Error(
      `Translation for locale ${input.locale} unexpectedly introduced ${rule.label} script.`,
    )
  }
}
