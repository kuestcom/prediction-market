import type { HomeFeaturedEventCard, Market } from '@/types'

import { resolveSupportedLocale } from '@/i18n/locales'

const ENGLISH_DATE_LABEL_PATTERN = /^([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?$/
const ENGLISH_TIME_LABEL_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
const FULL_LID_TITLE_PATTERN =
  /^Will the White House call a full lid by (.+?)\? \(([A-Za-z]+ \d{1,2}(?:, \d{4})?) [-–] ([A-Za-z]+ \d{1,2}(?:, \d{4})?)\)$/
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

export function localizeHomeFeaturedDateLabel(value: string, locale: string) {
  const resolvedLocale = resolveSupportedLocale(locale)
  if (resolvedLocale === 'en') {
    return value
  }

  const match = ENGLISH_DATE_LABEL_PATTERN.exec(value.trim())
  if (!match) {
    return value
  }

  const [, monthName, rawDay, rawYear] = match
  const month = monthName ? ENGLISH_MONTH_INDEX[monthName.toLowerCase()] : undefined
  const day = Number(rawDay)
  const year = rawYear ? Number(rawYear) : 2000
  if (month == null || !Number.isInteger(day) || !Number.isInteger(year)) {
    return value
  }

  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return value
  }

  return new Intl.DateTimeFormat(resolvedLocale, {
    day: 'numeric',
    month: 'long',
    ...(rawYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date)
}

function localizeHomeFeaturedTimeLabel(value: string, locale: string) {
  const resolvedLocale = resolveSupportedLocale(locale)
  if (resolvedLocale === 'en') {
    return value
  }

  const match = ENGLISH_TIME_LABEL_PATTERN.exec(value.trim())
  if (!match) {
    return value
  }

  const [, rawHour, rawMinute, rawPeriod] = match
  const hour = Number(rawHour)
  const minute = Number(rawMinute ?? 0)
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute > 59) {
    return value
  }

  const hour24 = rawPeriod?.toUpperCase() === 'AM' ? hour % 12 : (hour % 12) + 12
  const date = new Date(Date.UTC(2000, 0, 1, hour24, minute))
  return new Intl.DateTimeFormat(resolvedLocale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

export function resolveHomeFeaturedFullLidTitleValues(title: string, locale: string) {
  const resolvedLocale = resolveSupportedLocale(locale)
  if (resolvedLocale === 'en') {
    return null
  }

  const match = FULL_LID_TITLE_PATTERN.exec(title)
  if (!match) {
    return null
  }

  const [, time, startDate, endDate] = match
  if (!time || !startDate || !endDate) {
    return null
  }

  return {
    time: localizeHomeFeaturedTimeLabel(time, resolvedLocale),
    startDate: localizeHomeFeaturedDateLabel(startDate, resolvedLocale),
    endDate: localizeHomeFeaturedDateLabel(endDate, resolvedLocale),
  }
}

function localizeMarketDateLabels(market: Market, locale: string): Market {
  const title = localizeHomeFeaturedDateLabel(market.title, locale)
  const shortTitle = market.short_title ? localizeHomeFeaturedDateLabel(market.short_title, locale) : market.short_title
  const metadata = market.metadata && typeof market.metadata === 'object' ? market.metadata : null
  const metadataShortTitle = metadata && typeof metadata.short_title === 'string' ? metadata.short_title : null
  const localizedMetadataShortTitle = metadataShortTitle
    ? localizeHomeFeaturedDateLabel(metadataShortTitle, locale)
    : metadataShortTitle
  const localizedMetadata =
    metadata && localizedMetadataShortTitle !== metadataShortTitle
      ? { ...metadata, short_title: localizedMetadataShortTitle }
      : market.metadata
  const outcomes = market.outcomes.map((outcome) => {
    const outcomeText = localizeHomeFeaturedDateLabel(outcome.outcome_text, locale)
    return outcomeText === outcome.outcome_text ? outcome : { ...outcome, outcome_text: outcomeText }
  })
  const changedOutcomes = outcomes.some((outcome, index) => outcome !== market.outcomes[index])

  if (
    title === market.title &&
    shortTitle === market.short_title &&
    localizedMetadata === market.metadata &&
    !changedOutcomes
  ) {
    return market
  }

  return {
    ...market,
    title,
    short_title: shortTitle,
    metadata: localizedMetadata,
    outcomes: changedOutcomes ? outcomes : market.outcomes,
  }
}

export function localizeHomeFeaturedMarketDates(item: HomeFeaturedEventCard, locale: string): HomeFeaturedEventCard {
  const resolvedLocale = resolveSupportedLocale(locale)
  if (resolvedLocale === 'en') {
    return item
  }

  const markets = item.event.markets.map((market) => localizeMarketDateLabels(market, resolvedLocale))
  const topOutcomes = item.topOutcomes.map((outcome) => ({
    ...outcome,
    label: localizeHomeFeaturedDateLabel(outcome.label, resolvedLocale),
  }))
  const changedMarkets = markets.some((market, index) => market !== item.event.markets[index])
  const changedOutcomes = topOutcomes.some((outcome, index) => outcome.label !== item.topOutcomes[index]?.label)

  if (!changedMarkets && !changedOutcomes) {
    return item
  }

  return {
    ...item,
    event: changedMarkets ? { ...item.event, markets } : item.event,
    topOutcomes: changedOutcomes ? topOutcomes : item.topOutcomes,
  }
}
