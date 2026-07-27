import type { NonDefaultLocale } from '@/i18n/locales'

interface TranslationLocaleRow {
  locale: NonDefaultLocale
}

interface TranslationScriptRule {
  allowedLocales: readonly NonDefaultLocale[]
  label: string
  pattern: RegExp
}

const DATED_UP_OR_DOWN_TITLE_PATTERN = /^(.+?) Up or Down on ([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?\?$/
const ENGLISH_MONTH_INDEX: Record<string, number> = {
  april: 3,
  august: 7,
  december: 11,
  february: 1,
  january: 0,
  july: 6,
  june: 5,
  march: 2,
  may: 4,
  november: 10,
  october: 9,
  september: 8,
}
const DATE_FORMATTER_LOCALES: Record<NonDefaultLocale, string> = {
  ar: 'ar-u-nu-latn',
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  pl: 'pl',
  pt: 'pt',
  ru: 'ru',
  zh: 'zh',
}
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
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

function formatLocalizedDate(locale: NonDefaultLocale, date: Date, includeYear: boolean) {
  const formatterKey = `${locale}:${includeYear ? 'year' : 'month-day'}`
  let formatter = dateFormatters.get(formatterKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(DATE_FORMATTER_LOCALES[locale], {
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    })
    dateFormatters.set(formatterKey, formatter)
  }

  return formatter.format(date)
}

function formatDatedUpOrDownTitle(locale: NonDefaultLocale, subject: string, date: string) {
  switch (locale) {
    case 'ar':
      return `${subject} صعودًا أم هبوطًا في ${date}؟`
    case 'de':
      return `${subject} am ${date} rauf oder runter?`
    case 'es':
      return `¿${subject} sube o baja el ${date}?`
    case 'fr':
      return `${subject} en hausse ou en baisse le ${date} ?`
    case 'it':
      return `${subject} sale o scende il ${date}?`
    case 'ja':
      return `${date}の${subject}は上がる？下がる？`
    case 'ko':
      return `${date} ${subject} 상승 또는 하락?`
    case 'pl':
      return `${subject} wzrośnie czy spadnie ${date}?`
    case 'pt':
      return `${subject} sobe ou desce em ${date}?`
    case 'ru':
      return `${subject} вырастет или упадет ${date}?`
    case 'zh':
      return `${date}${subject}会上涨还是下跌？`
  }
}

export function resolveDeterministicTranslation(input: {
  locale: NonDefaultLocale
  sourceLabel: 'event title' | 'tag name'
  sourceText: string
}) {
  if (input.sourceLabel !== 'event title') {
    return null
  }

  const match = DATED_UP_OR_DOWN_TITLE_PATTERN.exec(input.sourceText.trim())
  if (!match) {
    return null
  }

  const [, subject, englishMonth, rawDay, year] = match
  if (!subject || !englishMonth || !rawDay) {
    return null
  }

  const monthIndex = ENGLISH_MONTH_INDEX[englishMonth.toLowerCase()]
  const day = Number(rawDay)
  const numericYear = year ? Number(year) : 2000
  if (
    !subject.trim()
    || monthIndex == null
    || !Number.isInteger(day)
    || day < 1
    || day > 31
    || !Number.isInteger(numericYear)
  ) {
    return null
  }

  const parsedDate = new Date(Date.UTC(numericYear, monthIndex, day))
  if (parsedDate.getUTCMonth() !== monthIndex || parsedDate.getUTCDate() !== day) {
    return null
  }

  const localizedDate = formatLocalizedDate(input.locale, parsedDate, Boolean(year))
  return formatDatedUpOrDownTitle(input.locale, subject.trim(), localizedDate)
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
