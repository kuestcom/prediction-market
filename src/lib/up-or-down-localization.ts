import type { SupportedLocale } from '@/i18n/locales'

function formatUpOrDownPhrase(
  locale: SupportedLocale,
  subject: string,
) {
  switch (locale) {
    case 'ar':
      return `${subject} صعودًا أم هبوطًا`
    case 'de':
      return `${subject} rauf oder runter`
    case 'es':
      return `${subject} sube o baja`
    case 'fr':
      return `${subject} en hausse ou en baisse`
    case 'it':
      return `${subject} sale o scende`
    case 'ja':
      return `${subject}は上がる？下がる？`
    case 'ko':
      return `${subject} 상승 또는 하락`
    case 'pl':
      return `${subject} wzrośnie czy spadnie`
    case 'pt':
      return `${subject} sobe ou desce`
    case 'ru':
      return `${subject} вырастет или упадет`
    case 'zh':
      return `${subject}会上涨还是下跌`
    case 'en':
      return `${subject} Up or Down`
  }
}

export function formatCadenceUpOrDownTitle(
  locale: SupportedLocale,
  subject: string,
  cadence: string,
) {
  return `${formatUpOrDownPhrase(locale, subject)} ${cadence}`
}

export function formatDatedUpOrDownTitle(
  locale: SupportedLocale,
  subject: string,
  date: string,
) {
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
    case 'en':
      return `${subject} Up or Down on ${date}?`
  }
}

export function formatTimedUpOrDownTitle(
  locale: SupportedLocale,
  subject: string,
  date: string,
  time: string,
) {
  const separator = locale === 'ar'
    ? '، '
    : locale === 'ja' || locale === 'ko' || locale === 'zh'
      ? ' '
      : ', '
  return `${formatUpOrDownPhrase(locale, subject)} — ${date}${separator}${time} ET`
}
