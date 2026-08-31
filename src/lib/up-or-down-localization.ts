import type { SupportedLocale } from '@/i18n/locales'

const CHINESE_UP_OR_DOWN_SUBJECTS: Record<string, string> = {
  'Trump approval': '特朗普支持率',
}

export function localizeUpOrDownSubject(locale: SupportedLocale, subject: string) {
  return locale === 'zh' ? (CHINESE_UP_OR_DOWN_SUBJECTS[subject] ?? subject) : subject
}

export function normalizeLocalizedUpOrDownTitle(locale: SupportedLocale, title: string) {
  if (locale !== 'zh' || !title.includes('上涨还是下跌')) {
    return title
  }

  let normalized = title
  for (const [source, localized] of Object.entries(CHINESE_UP_OR_DOWN_SUBJECTS)) {
    normalized = normalized.replace(source, localized)
  }

  return normalized
    .replace(/^本周\s+/, '本周')
    .replace(/(\d{1,2}月)\s+(\d{1,2}日)\s*/g, '$1$2')
    .replace(/\?$/, '？')
}

function formatUpOrDownPhrase(locale: SupportedLocale, subject: string) {
  const localizedSubject = localizeUpOrDownSubject(locale, subject)

  switch (locale) {
    case 'ar':
      return `${localizedSubject} صعودًا أم هبوطًا`
    case 'de':
      return `${localizedSubject} rauf oder runter`
    case 'es':
      return `${localizedSubject} sube o baja`
    case 'fr':
      return `${localizedSubject} en hausse ou en baisse`
    case 'it':
      return `${localizedSubject} sale o scende`
    case 'ja':
      return `${localizedSubject}は上がる？下がる？`
    case 'ko':
      return `${localizedSubject} 상승 또는 하락`
    case 'pl':
      return `${localizedSubject} wzrośnie czy spadnie`
    case 'pt':
      return `${localizedSubject} sobe ou desce`
    case 'ru':
      return `${localizedSubject} вырастет или упадет`
    case 'zh':
      return `${localizedSubject}会上涨还是下跌`
    case 'en':
      return `${localizedSubject} Up or Down`
  }
}

export function formatCadenceUpOrDownTitle(locale: SupportedLocale, subject: string, cadence: string) {
  return `${formatUpOrDownPhrase(locale, subject)} ${cadence}`
}

export function formatDatedUpOrDownTitle(locale: SupportedLocale, subject: string, date: string) {
  const localizedSubject = localizeUpOrDownSubject(locale, subject)

  switch (locale) {
    case 'ar':
      return `${localizedSubject} صعودًا أم هبوطًا في ${date}؟`
    case 'de':
      return `${localizedSubject} am ${date} rauf oder runter?`
    case 'es':
      return `¿${localizedSubject} sube o baja el ${date}?`
    case 'fr':
      return `${localizedSubject} en hausse ou en baisse le ${date} ?`
    case 'it':
      return `${localizedSubject} sale o scende il ${date}?`
    case 'ja':
      return `${date}の${localizedSubject}は上がる？下がる？`
    case 'ko':
      return `${date} ${localizedSubject} 상승 또는 하락?`
    case 'pl':
      return `${localizedSubject} wzrośnie czy spadnie ${date}?`
    case 'pt':
      return `${localizedSubject} sobe ou desce em ${date}?`
    case 'ru':
      return `${localizedSubject} вырастет или упадет ${date}?`
    case 'zh':
      return `${date}${localizedSubject}会上涨还是下跌？`
    case 'en':
      return `${localizedSubject} Up or Down on ${date}?`
  }
}

export function formatWeeklyUpOrDownTitle(locale: SupportedLocale, subject: string) {
  const localizedSubject = localizeUpOrDownSubject(locale, subject)

  switch (locale) {
    case 'ar':
      return `${localizedSubject} صعودًا أم هبوطًا هذا الأسبوع؟`
    case 'de':
      return `${localizedSubject} diese Woche rauf oder runter?`
    case 'es':
      return `¿${localizedSubject} sube o baja esta semana?`
    case 'fr':
      return `${localizedSubject} en hausse ou en baisse cette semaine ?`
    case 'it':
      return `${localizedSubject} sale o scende questa settimana?`
    case 'ja':
      return `今週の${localizedSubject}は上がる？下がる？`
    case 'ko':
      return `이번 주 ${localizedSubject} 상승 또는 하락?`
    case 'pl':
      return `${localizedSubject} wzrośnie czy spadnie w tym tygodniu?`
    case 'pt':
      return `${localizedSubject} sobe ou desce esta semana?`
    case 'ru':
      return `${localizedSubject} вырастет или упадет на этой неделе?`
    case 'zh':
      return `本周${localizedSubject}会上涨还是下跌？`
    case 'en':
      return `${localizedSubject} Up or Down this week?`
  }
}

export function formatTimedUpOrDownTitle(locale: SupportedLocale, subject: string, date: string, time: string) {
  const separator = locale === 'ar' ? '، ' : locale === 'ja' || locale === 'ko' || locale === 'zh' ? ' ' : ', '
  return `${formatUpOrDownPhrase(locale, subject)} — ${date}${separator}${time} ET`
}
