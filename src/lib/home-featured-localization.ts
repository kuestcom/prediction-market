import type { NonDefaultLocale } from '@/i18n/locales'
import type { Event, HomeFeaturedEventCard, Market } from '@/types'

import { resolveSupportedLocale } from '@/i18n/locales'
import {
  formatLocalizedDate,
  formatLocalizedTime,
  parseEnglishDate,
  resolveDeterministicTranslation,
} from '@/lib/translations/batch'
import { normalizeLocalizedUpOrDownTitle } from '@/lib/up-or-down-localization'

const ENGLISH_DATE_LABEL_PATTERN = /^([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?$/
const ENGLISH_TIME_LABEL_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
const FULL_LID_TITLE_PATTERN =
  /^Will the White House call a full lid by (.+?)\? \(([A-Za-z]+ \d{1,2}(?:, \d{4})?) [-–] ([A-Za-z]+ \d{1,2}(?:, \d{4})?)\)$/
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
  const date = monthName && rawDay ? parseEnglishDate(monthName, rawDay, rawYear) : null
  if (!date) {
    return value
  }

  return formatLocalizedDate(resolvedLocale as NonDefaultLocale, date, Boolean(rawYear))
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
  return formatLocalizedTime(resolvedLocale as NonDefaultLocale, date)
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

export function localizeHomeEventCardTitle(title: string, locale: string) {
  const resolvedLocale = resolveSupportedLocale(locale)
  if (resolvedLocale === 'en') {
    return title
  }

  const localizedDateTitle = localizeHomeFeaturedDateLabel(title, resolvedLocale)
  const deterministicTitle = resolveDeterministicTranslation({
    locale: resolvedLocale as NonDefaultLocale,
    sourceLabel: 'event title',
    sourceText: title,
  })

  return normalizeLocalizedUpOrDownTitle(resolvedLocale, deterministicTitle ?? localizedDateTitle)
}

function localizeMarketDateLabels(market: Market, locale: string): Market {
  const title = market.title ? localizeHomeFeaturedDateLabel(market.title, locale) : market.title
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

export function localizeHomeEventMarketDates(event: Event, locale: string): Event {
  const resolvedLocale = resolveSupportedLocale(locale)
  if (resolvedLocale === 'en') {
    return event
  }

  const markets = event.markets.map((market) => localizeMarketDateLabels(market, resolvedLocale))
  return markets.some((market, index) => market !== event.markets[index]) ? { ...event, markets } : event
}

export function localizeHomeFeaturedMarketDates(item: HomeFeaturedEventCard, locale: string): HomeFeaturedEventCard {
  const event = localizeHomeEventMarketDates(item.event, locale)
  const topOutcomes = item.topOutcomes.map((outcome) => ({
    ...outcome,
    label: localizeHomeFeaturedDateLabel(outcome.label, locale),
  }))
  const changedOutcomes = topOutcomes.some((outcome, index) => outcome.label !== item.topOutcomes[index]?.label)

  if (event === item.event && !changedOutcomes) {
    return item
  }

  return {
    ...item,
    event,
    topOutcomes: changedOutcomes ? topOutcomes : item.topOutcomes,
  }
}
