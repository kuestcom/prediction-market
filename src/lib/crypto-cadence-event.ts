import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { resolveSupportedLocale } from '@/i18n/locales'
import { formatCadenceUpOrDownTitle } from '@/lib/up-or-down-localization'

const CRYPTO_EVENT_TIME_ZONE = 'America/New_York'
const CRYPTO_ASSETS = [
  { aliases: ['bitcoin', 'btc'], name: 'Bitcoin', slug: 'bitcoin', symbol: 'BTC' },
  { aliases: ['ethereum', 'eth'], name: 'Ethereum', slug: 'ethereum', symbol: 'ETH' },
  { aliases: ['solana', 'sol'], name: 'Solana', slug: 'solana', symbol: 'SOL' },
  { aliases: ['dogecoin', 'doge'], name: 'Dogecoin', slug: 'dogecoin', symbol: 'DOGE' },
  { aliases: ['binance coin', 'bnb'], name: 'BNB', slug: 'bnb', symbol: 'BNB' },
  { aliases: ['hyperliquid', 'hype'], name: 'HYPE', slug: 'hype', symbol: 'HYPE' },
  { aliases: ['xrp'], name: 'XRP', slug: 'xrp', symbol: 'XRP' },
] as const
const CRYPTO_EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  timeZone: CRYPTO_EVENT_TIME_ZONE,
})
const CRYPTO_EVENT_HOUR_FORMATTER = new Intl.DateTimeFormat('en', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: CRYPTO_EVENT_TIME_ZONE,
})
const CRYPTO_EVENT_DAY_FORMATTER = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'numeric',
  timeZone: CRYPTO_EVENT_TIME_ZONE,
  year: 'numeric',
})
const localizedDateFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>()
const localizedDateTimeRangeFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>()
const localizedTimeRangeFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>()
const localizedUnitFormatters = new Map<string, Intl.NumberFormat>()
const HOURLY_LABELS: Record<SupportedLocale, string> = {
  ar: 'كل ساعة',
  de: 'Stündlich',
  en: 'Hourly',
  es: 'Cada hora',
  fr: 'Horaire',
  it: 'Ogni ora',
  ja: '毎時',
  ko: '시간 단위',
  pl: 'Cogodzinny',
  pt: 'Por hora',
  ru: 'Ежечасно',
  zh: '每小时',
}
const DAILY_LABELS: Record<SupportedLocale, string> = {
  ar: 'يوميًا',
  de: 'Täglich',
  en: 'Daily',
  es: 'Diario',
  fr: 'Quotidien',
  it: 'Quotidiano',
  ja: 'デイリー',
  ko: '일간',
  pl: 'Codziennie',
  pt: 'Diário',
  ru: 'Ежедневно',
  zh: '每日',
}

export const CRYPTO_CADENCE_ROUTES = [
  {
    cadence: '5m',
    durationMinutes: 5,
    recurrenceValues: ['5m', '5min'],
    routeSlug: '5M',
    seriesTokens: ['5m'],
    sidebarLabel: '5 Min',
    titleSuffix: '5m',
  },
  {
    cadence: '15m',
    durationMinutes: 15,
    recurrenceValues: ['15m', '15min'],
    routeSlug: '15M',
    seriesTokens: ['15m'],
    sidebarLabel: '15 Min',
    titleSuffix: '15m',
  },
  {
    cadence: 'hourly',
    durationMinutes: 60,
    recurrenceValues: ['hourly', '1h'],
    routeSlug: 'hourly',
    seriesTokens: ['hourly', '1h'],
    sidebarLabel: '1 Hour',
    titleSuffix: 'Hourly',
  },
  {
    cadence: '4h',
    durationMinutes: 4 * 60,
    recurrenceValues: ['4h', '4hour'],
    routeSlug: '4hour',
    seriesTokens: ['4h', '4hour'],
    sidebarLabel: '4 Hours',
    titleSuffix: '4h',
  },
  {
    cadence: 'daily',
    durationMinutes: 24 * 60,
    recurrenceValues: ['daily', '1d'],
    routeSlug: 'daily',
    seriesTokens: ['daily', '1d'],
    sidebarLabel: 'Daily',
    titleSuffix: 'Daily',
  },
] as const

interface CryptoTaxonomyCandidate {
  main_tag?: string | null
  tags?: Array<{
    name?: string | null
    slug?: string | null
  }>
}

interface CryptoCadenceCandidate {
  series_recurrence?: string | null
  series_slug?: string | null
}

type CryptoEventCandidate = Pick<
  Event,
  'end_date' | 'title'
> & CryptoCadenceCandidate & CryptoTaxonomyCandidate

interface HourLabelParts {
  dayPeriod: string
  hour: string
  minute: string
}

function normalizeCadenceValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function resolveCryptoCadenceRoute(routeSlug: string | null | undefined) {
  const normalizedRouteSlug = normalizeCadenceValue(routeSlug)
  return CRYPTO_CADENCE_ROUTES.find(route =>
    route.routeSlug.toLowerCase() === normalizedRouteSlug,
  ) ?? null
}

export function resolveCryptoCadenceSidebarLabel(
  route: (typeof CRYPTO_CADENCE_ROUTES)[number],
  localeValue?: string | null,
) {
  const locale = resolveSupportedLocale(localeValue)
  if (locale === 'en') {
    return route.sidebarLabel
  }
  if (route.cadence === 'daily') {
    return DAILY_LABELS[locale]
  }

  const isMinuteCadence = route.cadence === '5m' || route.cadence === '15m'
  const value = route.cadence === '5m'
    ? 5
    : route.cadence === '15m'
      ? 15
      : route.cadence === '4h'
        ? 4
        : 1
  const unit = isMinuteCadence ? 'minute' : 'hour'
  const formatterKey = `${locale}:${unit}`
  let formatter = localizedUnitFormatters.get(formatterKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'long',
    })
    localizedUnitFormatters.set(formatterKey, formatter)
  }

  return formatter.format(value)
}

export function resolveCryptoCadenceRelatedLabel(
  route: (typeof CRYPTO_CADENCE_ROUTES)[number],
  localeValue?: string | null,
) {
  const locale = resolveSupportedLocale(localeValue)
  if (locale === 'en' && route.cadence === '4h') {
    return '4 Hour'
  }

  return resolveCryptoCadenceSidebarLabel(route, locale)
}

function resolveCryptoEventCadence(event: CryptoCadenceCandidate) {
  const seriesSegments = new Set(
    normalizeCadenceValue(event.series_slug).split('-').filter(Boolean),
  )
  const seriesCadence = CRYPTO_CADENCE_ROUTES.find(route =>
    route.seriesTokens.some(token => seriesSegments.has(token)),
  )
  if (seriesCadence) {
    return seriesCadence
  }

  const recurrence = normalizeCadenceValue(event.series_recurrence)
  return CRYPTO_CADENCE_ROUTES.find(route =>
    (route.recurrenceValues as readonly string[]).includes(recurrence),
  ) ?? null
}

export function resolveCryptoCadenceRouteSlug(event: CryptoCadenceCandidate) {
  return resolveCryptoEventCadence(event)?.routeSlug ?? null
}

export function matchesCryptoCadenceRoute(
  event: CryptoCadenceCandidate,
  routeSlug: string | null | undefined,
) {
  const route = resolveCryptoCadenceRoute(routeSlug)
  return Boolean(route && resolveCryptoEventCadence(event)?.cadence === route.cadence)
}

export function isCryptoEvent(event: CryptoTaxonomyCandidate) {
  if (event.main_tag?.trim().toLowerCase() === 'crypto') {
    return true
  }

  return event.tags?.some(tag =>
    tag.slug?.trim().toLowerCase() === 'crypto'
    || tag.name?.trim().toLowerCase() === 'crypto',
  ) ?? false
}

export function resolveCryptoEventAsset(event: CryptoEventCandidate) {
  if (!isCryptoEvent(event)) {
    return null
  }

  const seriesSlug = event.series_slug?.trim().toLowerCase() ?? ''
  const normalizedTitle = event.title.trim().toLowerCase()

  for (const asset of CRYPTO_ASSETS) {
    if (asset.aliases.some(alias =>
      seriesSlug === alias
      || seriesSlug.startsWith(`${alias}-`)
      || normalizedTitle === alias
      || normalizedTitle.startsWith(`${alias} `)
      || event.tags?.some(tag =>
        tag.slug?.trim().toLowerCase() === alias
        || tag.name?.trim().toLowerCase() === alias,
      ),
    )) {
      return asset
    }
  }

  return null
}

function parseEventDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatHourParts(date: Date): HourLabelParts {
  const parts = CRYPTO_EVENT_HOUR_FORMATTER.formatToParts(date)

  return {
    hour: parts.find(part => part.type === 'hour')?.value ?? '',
    minute: parts.find(part => part.type === 'minute')?.value ?? '',
    dayPeriod: parts.find(part => part.type === 'dayPeriod')?.value.toUpperCase() ?? '',
  }
}

function formatHour(parts: HourLabelParts, includeDayPeriod: boolean) {
  const minuteLabel = parts.minute === '00' ? '' : `:${parts.minute}`
  const dayPeriodLabel = includeDayPeriod ? parts.dayPeriod : ''

  return `${parts.hour}${minuteLabel}${dayPeriodLabel}`
}

function formatCryptoCadenceWindow(
  endDateValue: string | null | undefined,
  durationMinutes: number,
  locale: SupportedLocale,
) {
  const endDate = parseEventDate(endDateValue)
  if (!endDate) {
    return null
  }

  const startDate = new Date(endDate.getTime() - durationMinutes * 60 * 1000)
  let dateFormatter = localizedDateFormatters.get(locale)
  if (!dateFormatter) {
    dateFormatter = locale === 'en'
      ? CRYPTO_EVENT_DATE_FORMATTER
      : new Intl.DateTimeFormat(locale, {
          month: 'long',
          day: 'numeric',
          timeZone: CRYPTO_EVENT_TIME_ZONE,
        })
    localizedDateFormatters.set(locale, dateFormatter)
  }
  const dateLabel = dateFormatter.format(startDate)
  if (durationMinutes >= 24 * 60) {
    return dateLabel
  }

  const crossesCalendarDate = CRYPTO_EVENT_DAY_FORMATTER.format(startDate)
    !== CRYPTO_EVENT_DAY_FORMATTER.format(endDate)

  if (locale !== 'en') {
    if (crossesCalendarDate) {
      let dateTimeRangeFormatter = localizedDateTimeRangeFormatters.get(locale)
      if (!dateTimeRangeFormatter) {
        dateTimeRangeFormatter = new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          month: 'long',
          timeZone: CRYPTO_EVENT_TIME_ZONE,
        })
        localizedDateTimeRangeFormatters.set(locale, dateTimeRangeFormatter)
      }

      return `${dateTimeRangeFormatter.formatRange(startDate, endDate)} ET`
    }

    let timeFormatter = localizedTimeRangeFormatters.get(locale)
    if (!timeFormatter) {
      timeFormatter = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: CRYPTO_EVENT_TIME_ZONE,
      })
      localizedTimeRangeFormatters.set(locale, timeFormatter)
    }

    const separator = locale === 'ar'
      ? '، '
      : locale === 'ja' || locale === 'ko' || locale === 'zh'
        ? ' '
        : ', '
    return `${dateLabel}${separator}${timeFormatter.formatRange(startDate, endDate)} ET`
  }

  const startParts = formatHourParts(startDate)
  const endParts = formatHourParts(endDate)
  const startLabel = formatHour(startParts, startParts.dayPeriod !== endParts.dayPeriod)
  const endLabel = formatHour(endParts, true)

  if (crossesCalendarDate) {
    return `${dateLabel}, ${startLabel}-${dateFormatter.format(endDate)}, ${endLabel} ET`
  }

  return `${dateLabel}, ${startLabel}-${endLabel} ET`
}

function resolveCryptoCadenceTitleSuffix(
  cadence: (typeof CRYPTO_CADENCE_ROUTES)[number],
  locale: SupportedLocale,
) {
  if (cadence.cadence === 'hourly') {
    return HOURLY_LABELS[locale]
  }
  if (cadence.cadence === 'daily') {
    return DAILY_LABELS[locale]
  }
  return cadence.titleSuffix
}

export function resolveCryptoCadenceEventTitle(
  event: CryptoEventCandidate,
  localeValue?: string | null,
) {
  if (!isCryptoEvent(event)) {
    return null
  }

  const locale = resolveSupportedLocale(localeValue)
  const cadence = resolveCryptoEventCadence(event)
  const asset = resolveCryptoEventAsset(event)
  return asset && cadence
    ? formatCadenceUpOrDownTitle(
        locale,
        asset.symbol,
        resolveCryptoCadenceTitleSuffix(cadence, locale),
      )
    : null
}

export function resolveCryptoCadenceRelatedEventTitle(
  event: CryptoEventCandidate,
  localeValue?: string | null,
) {
  if (!isCryptoEvent(event)) {
    return null
  }

  const cadence = resolveCryptoEventCadence(event)
  if (cadence?.cadence !== '5m' && cadence?.cadence !== '15m') {
    return null
  }

  const asset = resolveCryptoEventAsset(event)
  if (!asset) {
    return null
  }

  return formatCadenceUpOrDownTitle(
    resolveSupportedLocale(localeValue),
    asset.symbol,
    `- ${cadence.titleSuffix}`,
  )
}

export function resolveCryptoCadenceEventPresentation(
  event: CryptoEventCandidate,
  localeValue?: string | null,
) {
  const locale = resolveSupportedLocale(localeValue)
  const cadence = resolveCryptoEventCadence(event)
  const title = resolveCryptoCadenceEventTitle(event, locale)
  if (!cadence || !title) {
    return null
  }

  return {
    title,
    subtitle: cadence.cadence === 'daily'
      ? null
      : formatCryptoCadenceWindow(event.end_date, cadence.durationMinutes, locale),
  }
}

export function resolveCryptoEventAssetName(event: CryptoEventCandidate) {
  const asset = resolveCryptoEventAsset(event)
  if (!asset) {
    return null
  }

  if (asset.name === asset.name.toUpperCase()) {
    return asset.name
  }

  const aliases = new Set<string>(asset.aliases)
  const localizedTagName = event.tags?.find(tag =>
    aliases.has(normalizeCadenceValue(tag.slug)),
  )?.name?.trim()

  return localizedTagName || asset.name
}
