import type { NonDefaultLocale } from '@/i18n/locales'

import {
  formatDatedUpOrDownTitle,
  formatTimedUpOrDownTitle,
  formatWeeklyUpOrDownTitle,
} from '@/lib/up-or-down-localization'

interface TranslationLocaleRow {
  locale: NonDefaultLocale
}

interface TranslationScriptRule {
  allowedLocales: readonly NonDefaultLocale[]
  label: string
  pattern: RegExp
}

const DATED_UP_OR_DOWN_TITLE_PATTERN = /^(.+?) Up or Down on ([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?\?$/
const TIMED_UP_OR_DOWN_TITLE_PATTERN =
  /^(.+?) Up or Down - ([A-Z]+) (\d{1,2})(?:, (\d{4}))?, (\d{1,2})(?::(\d{2}))?\s*(AM|PM) ET$/i
const WEEKLY_UP_OR_DOWN_TITLE_PATTERN = /^(.+?) Up or Down this week\?$/i
const DETERMINISTIC_UP_OR_DOWN_TRANSLATION_VERSION = 'up-or-down-v2'
const DETERMINISTIC_WEEKLY_UP_OR_DOWN_TRANSLATION_VERSION = 'up-or-down-weekly-v1'
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

function formatLocalizedTime(locale: NonDefaultLocale, date: Date) {
  const formatterKey = `${locale}:time`
  let formatter = dateFormatters.get(formatterKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(DATE_FORMATTER_LOCALES[locale], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    })
    dateFormatters.set(formatterKey, formatter)
  }

  return formatter.format(date)
}

function parseEnglishDate(englishMonth: string, rawDay: string, year: string | undefined) {
  const monthIndex = ENGLISH_MONTH_INDEX[englishMonth.toLowerCase()]
  const day = Number(rawDay)
  const numericYear = year ? Number(year) : 2000
  if (monthIndex == null || !Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(numericYear)) {
    return null
  }

  const parsedDate = new Date(Date.UTC(numericYear, monthIndex, day))
  return parsedDate.getUTCMonth() === monthIndex && parsedDate.getUTCDate() === day ? parsedDate : null
}

export function resolveDeterministicTranslation(input: {
  locale: NonDefaultLocale
  sourceLabel: 'event title' | 'tag name'
  sourceText: string
}) {
  if (input.sourceLabel !== 'event title') {
    return null
  }

  const sourceText = input.sourceText.trim()
  const weeklyMatch = WEEKLY_UP_OR_DOWN_TITLE_PATTERN.exec(sourceText)
  if (weeklyMatch) {
    const [, subject] = weeklyMatch
    return subject?.trim() ? formatWeeklyUpOrDownTitle(input.locale, subject.trim()) : null
  }

  const datedMatch = DATED_UP_OR_DOWN_TITLE_PATTERN.exec(sourceText)
  if (datedMatch) {
    const [, subject, englishMonth, rawDay, year] = datedMatch
    if (!subject || !englishMonth || !rawDay || !subject.trim()) {
      return null
    }

    const parsedDate = parseEnglishDate(englishMonth, rawDay, year)
    if (!parsedDate) {
      return null
    }

    const localizedDate = formatLocalizedDate(input.locale, parsedDate, Boolean(year))
    return formatDatedUpOrDownTitle(input.locale, subject.trim(), localizedDate)
  }

  const timedMatch = TIMED_UP_OR_DOWN_TITLE_PATTERN.exec(sourceText)
  if (!timedMatch) {
    return null
  }

  const [, subject, englishMonth, rawDay, year, rawHour, rawMinute, rawDayPeriod] = timedMatch
  if (!subject || !englishMonth || !rawDay || !rawHour || !rawDayPeriod || !subject.trim()) {
    return null
  }

  const parsedDate = parseEnglishDate(englishMonth, rawDay, year)
  const hour = Number(rawHour)
  const minute = rawMinute ? Number(rawMinute) : 0
  if (
    !parsedDate ||
    !Number.isInteger(hour) ||
    hour < 1 ||
    hour > 12 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  const hour24 = rawDayPeriod.toUpperCase() === 'AM' ? hour % 12 : (hour % 12) + 12
  parsedDate.setUTCHours(hour24, minute)
  const localizedDate = formatLocalizedDate(input.locale, parsedDate, Boolean(year))
  const localizedTime = formatLocalizedTime(input.locale, parsedDate)
  return formatTimedUpOrDownTitle(input.locale, subject.trim(), localizedDate, localizedTime)
}

export function resolveDeterministicTranslationVersion(input: {
  locale: NonDefaultLocale
  sourceLabel: 'event title' | 'tag name'
  sourceText: string
}) {
  const sourceText = input.sourceText.trim()
  if (input.sourceLabel === 'event title' && WEEKLY_UP_OR_DOWN_TITLE_PATTERN.test(sourceText)) {
    return resolveDeterministicTranslation(input) ? DETERMINISTIC_WEEKLY_UP_OR_DOWN_TRANSLATION_VERSION : null
  }

  return resolveDeterministicTranslation(input) ? DETERMINISTIC_UP_OR_DOWN_TRANSLATION_VERSION : null
}

export function resolveTranslationSourceFingerprint(input: {
  locale: NonDefaultLocale
  sourceLabel: 'event title' | 'tag name'
  sourceText: string
}) {
  const deterministicVersion = resolveDeterministicTranslationVersion(input)
  return deterministicVersion ? `${input.sourceText}\0${deterministicVersion}` : input.sourceText
}

export function assertTranslationUsesExpectedScript(input: {
  locale: NonDefaultLocale
  sourceText: string
  translatedText: string
}) {
  for (const rule of TRANSLATION_SCRIPT_RULES) {
    if (
      rule.allowedLocales.includes(input.locale) ||
      !rule.pattern.test(input.translatedText) ||
      rule.pattern.test(input.sourceText)
    ) {
      continue
    }

    throw new Error(`Translation for locale ${input.locale} unexpectedly introduced ${rule.label} script.`)
  }
}
