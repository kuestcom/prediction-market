import type { SupportedLocale } from '@/i18n/locales'

const UP_OR_DOWN_SUBJECT_TRANSLATIONS: Record<string, Partial<Record<SupportedLocale, string>>> = {
  'Trump approval': {
    ar: 'تأييد ترامب',
    de: 'Trump-Zustimmung',
    es: 'Aprobación de Trump',
    fr: 'Approbation de Trump',
    it: 'Approvazione di Trump',
    ja: 'トランプ支持率',
    ko: '트럼프 지지율',
    pl: 'Poparcie dla Trumpa',
    pt: 'Aprovação de Trump',
    ru: 'Одобрение Трампа',
    zh: '特朗普支持率',
  },
}
const UP_OR_DOWN_TITLE_MARKERS = [
  'up or down',
  'صعود أم هبوط',
  'صعودًا أم هبوطًا',
  'صعودا أم هبوطا',
  'rauf oder runter',
  'sube o baja',
  'en hausse ou en baisse',
  'sale o scende',
  '上がる？下がる？',
  '상승 또는 하락',
  'wzrośnie czy spadnie',
  'sobe ou desce',
  'вырастет или упадет',
  '上涨还是下跌',
] as const

function isUpOrDownTitle(title: string) {
  const normalizedTitle = title.toLowerCase()
  return UP_OR_DOWN_TITLE_MARKERS.some((marker) => normalizedTitle.includes(marker.toLowerCase()))
}

function localizeUpOrDownSubject(locale: SupportedLocale, subject: string) {
  return UP_OR_DOWN_SUBJECT_TRANSLATIONS[subject]?.[locale] ?? subject
}

export function normalizeLocalizedUpOrDownTitle(locale: SupportedLocale, title: string) {
  if (!isUpOrDownTitle(title)) {
    return title
  }

  let normalized = title
  for (const [source, translations] of Object.entries(UP_OR_DOWN_SUBJECT_TRANSLATIONS)) {
    const localized = translations[locale]
    if (localized) {
      normalized = normalized.replaceAll(source, localized)
    }
  }

  if (locale !== 'zh' || !normalized.includes('上涨还是下跌')) {
    return normalized
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
