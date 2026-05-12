import type { Event, Market, Outcome } from '@/types'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatCompactCount, formatDate } from '@/lib/formatters'

export interface EventFaqItem {
  id: string
  question: string
  answer: string
}

interface BuildEventFaqItemsOptions {
  event: Event
  siteName: string
  commentsCount?: number | null
  translate: EventFaqTranslator
}

interface FaqSelection {
  label: string
  cents: number
}

type EventFaqTranslationValues = Record<string, string | number>
type EventFaqMessageKey
  = | 'thisMarket'
    | 'thisOutcome'
    | 'yesOutcome'
    | 'choiceSummary'
    | 'siteAccuracySentence'
    | 'whatIsBinaryAnswer'
    | 'leadingOutcomeSentence'
    | 'nextClosestOutcomeSentence'
    | 'whatIsMultiAnswer'
    | 'launchedOnDate'
    | 'lowVolumeAnswer'
    | 'sinceMarketLaunchedOnDate'
    | 'standardVolumeAnswer'
    | 'tradeBinaryAnswer'
    | 'tradeMultiAnswer'
    | 'currentOddsBinaryAnswer'
    | 'currentFrontrunnerSentence'
    | 'currentPricesUpdateSentence'
    | 'currentOddsMultiAnswer'
    | 'resolutionAnswer'
    | 'followAnswer'
    | 'reliabilityAnswer'
    | 'startTradingAnswer'
    | 'priceMeaningBinaryAnswer'
    | 'priceMeaningMultiAnswer'
    | 'resolvedCloseAnswer'
    | 'openCloseAnswer'
    | 'scheduledCloseAnswer'
    | 'activeCommentsAnswer'
    | 'lowCommentsAnswer'
    | 'whatIsSiteAnswer'
    | 'whatIsQuestion'
    | 'tradingActivityQuestion'
    | 'howToTradeQuestion'
    | 'currentOddsQuestion'
    | 'resolutionQuestion'
    | 'followQuestion'
    | 'reliabilityQuestion'
    | 'startTradingQuestion'
    | 'priceMeaningBinaryQuestion'
    | 'priceMeaningMultiQuestion'
    | 'closeTimeQuestion'
    | 'tradersSayingQuestion'
    | 'whatIsSiteQuestion'

export type EventFaqTranslatedMessages = Record<EventFaqMessageKey, string>
export type EventFaqTranslator = (message: EventFaqMessageKey, values?: EventFaqTranslationValues) => string

const LOW_VOLUME_THRESHOLD = 10_000
const ACTIVE_COMMENTS_THRESHOLD = 10
const CENTS_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function interpolateEventFaqMessage(message: string, values?: EventFaqTranslationValues) {
  if (!values) {
    return message
  }

  return message.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value == null ? match : String(value)
  })
}

export function createEventFaqTranslator(messages: EventFaqTranslatedMessages): EventFaqTranslator {
  return function translateEventFaqMessage(message, values) {
    return interpolateEventFaqMessage(messages[message] ?? message, values)
  }
}

function quoteLabel(value: string | null | undefined, t: EventFaqTranslator, fallbackLabel = t('thisMarket')) {
  const normalized = value?.trim()
  return `"${normalized || fallbackLabel}"`
}

function clampCents(value: number) {
  if (!Number.isFinite(value)) {
    return 50
  }

  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

function formatFaqCents(value: number) {
  return `${CENTS_FORMATTER.format(clampCents(value))}¢`
}

function formatPercentFromCents(cents: number) {
  return `${Math.round(clampCents(cents))}%`
}

function formatFaqCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '$0'
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const display = Number.isInteger(Math.round(millions)) && Math.abs(millions - Math.round(millions)) < 0.05
      ? `${Math.round(millions)}`
      : millions.toFixed(1).replace(/\.0$/, '')
    return `$${display} million`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  }

  return `$${Math.round(value)}`
}

function formatMonthDayYear(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return formatDate(date)
}

function resolveMarketLabel(market: Market, t: EventFaqTranslator) {
  return market.short_title?.trim() || market.title?.trim() || t('thisOutcome')
}

function resolveMarketPriceCents(market: Market) {
  if (Number.isFinite(market.price)) {
    return clampCents(market.price * 100)
  }

  if (Number.isFinite(market.probability)) {
    return clampCents(market.probability)
  }

  return 50
}

function resolveOutcomePriceCents(outcome: Outcome, market: Market) {
  if (Number.isFinite(outcome.buy_price)) {
    return clampCents(Number(outcome.buy_price) * 100)
  }

  const yesCents = resolveMarketPriceCents(market)
  if (outcome.outcome_index === OUTCOME_INDEX.YES) {
    return yesCents
  }

  if (outcome.outcome_index === OUTCOME_INDEX.NO) {
    return clampCents(100 - yesCents)
  }

  return null
}

function resolveTotalMarketsCount(event: Event) {
  return Math.max(event.total_markets_count ?? 0, event.markets.length)
}

function isBinaryEvent(event: Event) {
  return resolveTotalMarketsCount(event) <= 1
}

function isResolvedEvent(event: Event) {
  return event.status === 'resolved'
    || Boolean(event.resolved_at)
    || (event.markets.length > 0 && event.markets.every(market => market.is_resolved || market.condition?.resolved))
}

function resolveBinaryYesCents(event: Event) {
  const market = event.markets[0]
  if (!market) {
    return 50
  }

  const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES) ?? null
  if (!yesOutcome) {
    return resolveMarketPriceCents(market)
  }

  return resolveOutcomePriceCents(yesOutcome, market) ?? resolveMarketPriceCents(market)
}

function resolveBinarySelection(event: Event, t: EventFaqTranslator): FaqSelection {
  return {
    label: t('yesOutcome'),
    cents: resolveBinaryYesCents(event),
  }
}

function resolveFrontRunnerSelections(event: Event, t: EventFaqTranslator) {
  return Array.from(event.markets, market => ({
    label: resolveMarketLabel(market, t),
    cents: resolveMarketPriceCents(market),
  }))
    .sort((left, right) => right.cents - left.cents)
}

function resolvePrimarySelection(event: Event, t: EventFaqTranslator) {
  if (isBinaryEvent(event)) {
    return resolveBinarySelection(event, t)
  }

  return resolveFrontRunnerSelections(event, t)[0] ?? {
    label: t('thisOutcome'),
    cents: 50,
  }
}

function formatChoice(selection: FaqSelection, t: EventFaqTranslator) {
  return t('choiceSummary', {
    label: quoteLabel(selection.label, t),
    price: formatFaqCents(selection.cents),
    probability: formatPercentFromCents(selection.cents),
  })
}

function buildSiteAccuracySentence(siteName: string, t: EventFaqTranslator) {
  return t('siteAccuracySentence', {
    siteName,
  })
}

function buildWhatIsBinaryAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  const yesSelection = resolveBinarySelection(event, t)

  return t('whatIsBinaryAnswer', {
    eventTitle: quoteLabel(event.title, t),
    siteName,
    probability: formatPercentFromCents(yesSelection.cents),
    price: formatFaqCents(yesSelection.cents),
  })
}

function buildWhatIsMultiAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  const frontRunners = resolveFrontRunnerSelections(event, t)
  const leader = frontRunners[0] ?? null
  const runnerUp = frontRunners[1] ?? null
  const leaderSentence = leader
    ? t('leadingOutcomeSentence', { choice: formatChoice(leader, t) })
    : ''
  const runnerUpSentence = runnerUp
    ? t('nextClosestOutcomeSentence', { choice: formatChoice(runnerUp, t) })
    : ''
  const exampleSelection = leader ?? runnerUp ?? { label: t('thisOutcome'), cents: 50 }

  return t('whatIsMultiAnswer', {
    eventTitle: quoteLabel(event.title, t),
    siteName,
    outcomesCount: resolveTotalMarketsCount(event).toString(),
    leaderSentence,
    runnerUpSentence,
    price: formatFaqCents(exampleSelection.cents),
    probability: formatPercentFromCents(exampleSelection.cents),
  })
}

function buildLowVolumeAnswer(event: Event, t: EventFaqTranslator) {
  const createdAtLabel = formatMonthDayYear(event.created_at)
  const launchedText = createdAtLabel ? t('launchedOnDate', { date: createdAtLabel }) : ''

  return t('lowVolumeAnswer', {
    eventTitle: quoteLabel(event.title, t),
    launchedText,
  })
}

function buildStandardVolumeAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  const createdAtLabel = formatMonthDayYear(event.created_at)
  const launchedText = createdAtLabel ? t('sinceMarketLaunchedOnDate', { date: createdAtLabel }) : ''

  return t('standardVolumeAnswer', {
    eventTitle: quoteLabel(event.title, t),
    volume: formatFaqCurrency(event.volume),
    launchedText,
    siteName,
  })
}

function buildTradeBinaryAnswer(event: Event, t: EventFaqTranslator) {
  return t('tradeBinaryAnswer', {
    eventTitle: quoteLabel(event.title, t),
  })
}

function buildTradeMultiAnswer(event: Event, t: EventFaqTranslator) {
  return t('tradeMultiAnswer', {
    eventTitle: quoteLabel(event.title, t),
    outcomesCount: resolveTotalMarketsCount(event).toString(),
  })
}

function buildCurrentOddsBinaryAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  const yesSelection = resolveBinarySelection(event, t)

  return t('currentOddsBinaryAnswer', {
    eventTitle: quoteLabel(event.title, t),
    probability: formatPercentFromCents(yesSelection.cents),
    siteName,
  })
}

function buildCurrentOddsMultiAnswer(event: Event, t: EventFaqTranslator) {
  const frontRunners = resolveFrontRunnerSelections(event, t)
  const leader = frontRunners[0] ?? null
  const runnerUp = frontRunners[1] ?? null
  const leaderSentence = leader
    ? t('currentFrontrunnerSentence', {
        eventTitle: quoteLabel(event.title, t),
        choice: formatChoice(leader, t),
        probability: formatPercentFromCents(leader.cents),
      })
    : t('currentPricesUpdateSentence', {
        eventTitle: quoteLabel(event.title, t),
      })
  const runnerUpSentence = runnerUp
    ? t('nextClosestOutcomeSentence', { choice: formatChoice(runnerUp, t) })
    : ''

  return t('currentOddsMultiAnswer', {
    leaderSentence,
    runnerUpSentence,
  })
}

function buildResolutionAnswer(event: Event, t: EventFaqTranslator) {
  return t('resolutionAnswer', {
    eventTitle: quoteLabel(event.title, t),
  })
}

function buildFollowAnswer(event: Event, t: EventFaqTranslator) {
  return t('followAnswer', {
    eventTitle: quoteLabel(event.title, t),
  })
}

function buildReliabilityAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  return t('reliabilityAnswer', {
    siteName,
    volume: formatFaqCurrency(event.volume),
    eventTitle: quoteLabel(event.title, t),
    accuracySentence: buildSiteAccuracySentence(siteName, t),
  })
}

function buildStartTradingAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  return t('startTradingAnswer', {
    eventTitle: quoteLabel(event.title, t),
    siteName,
  })
}

function buildPriceMeaningBinaryAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  const yesSelection = resolveBinarySelection(event, t)
  const profitCents = clampCents(100 - yesSelection.cents)

  return t('priceMeaningBinaryAnswer', {
    siteName,
    price: formatFaqCents(yesSelection.cents),
    eventTitle: quoteLabel(event.title, t),
    probability: formatPercentFromCents(yesSelection.cents),
    profit: formatFaqCents(profitCents),
  })
}

function buildPriceMeaningMultiAnswer(event: Event, siteName: string, t: EventFaqTranslator) {
  const selection = resolvePrimarySelection(event, t)
  const profitCents = clampCents(100 - selection.cents)

  return t('priceMeaningMultiAnswer', {
    siteName,
    price: formatFaqCents(selection.cents),
    selectionLabel: quoteLabel(selection.label, t),
    eventTitle: quoteLabel(event.title, t),
    probability: formatPercentFromCents(selection.cents),
    profit: formatFaqCents(profitCents),
  })
}

function buildCloseAnswer(event: Event, t: EventFaqTranslator) {
  if (isResolvedEvent(event)) {
    return t('resolvedCloseAnswer', {
      eventTitle: quoteLabel(event.title, t),
    })
  }

  const closeDate = formatMonthDayYear(event.end_date ?? event.resolved_at ?? event.start_date)
  if (!closeDate) {
    return t('openCloseAnswer', {
      eventTitle: quoteLabel(event.title, t),
    })
  }

  return t('scheduledCloseAnswer', {
    eventTitle: quoteLabel(event.title, t),
    closeDate,
  })
}

function buildTradersSayingAnswer(event: Event, commentsCount: number | null | undefined, t: EventFaqTranslator) {
  if (commentsCount != null && Number.isFinite(commentsCount) && commentsCount >= ACTIVE_COMMENTS_THRESHOLD) {
    return t('activeCommentsAnswer', {
      eventTitle: quoteLabel(event.title, t),
      commentsCount: formatCompactCount(commentsCount),
    })
  }

  return t('lowCommentsAnswer', {
    eventTitle: quoteLabel(event.title, t),
  })
}

function buildWhatIsSiteAnswer(siteName: string, eventTitle: string, t: EventFaqTranslator) {
  return t('whatIsSiteAnswer', {
    siteName,
    eventTitle: quoteLabel(eventTitle, t),
  })
}

export function buildEventFaqItems({
  event,
  siteName,
  commentsCount,
  translate: t,
}: BuildEventFaqItemsOptions): EventFaqItem[] {
  const lowVolume = event.volume < LOW_VOLUME_THRESHOLD
  const binaryEvent = isBinaryEvent(event)
  const primarySelection = resolvePrimarySelection(event, t)

  return [
    {
      id: 'what-is',
      question: t('whatIsQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: binaryEvent
        ? buildWhatIsBinaryAnswer(event, siteName, t)
        : buildWhatIsMultiAnswer(event, siteName, t),
    },
    {
      id: 'trading-activity',
      question: t('tradingActivityQuestion', {
        eventTitle: quoteLabel(event.title, t),
        siteName,
      }),
      answer: lowVolume
        ? buildLowVolumeAnswer(event, t)
        : buildStandardVolumeAnswer(event, siteName, t),
    },
    {
      id: 'how-to-trade',
      question: t('howToTradeQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: binaryEvent
        ? buildTradeBinaryAnswer(event, t)
        : buildTradeMultiAnswer(event, t),
    },
    {
      id: 'current-odds',
      question: t('currentOddsQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: binaryEvent
        ? buildCurrentOddsBinaryAnswer(event, siteName, t)
        : buildCurrentOddsMultiAnswer(event, t),
    },
    {
      id: 'resolution',
      question: t('resolutionQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: buildResolutionAnswer(event, t),
    },
    {
      id: 'follow-without-trade',
      question: t('followQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: buildFollowAnswer(event, t),
    },
    {
      id: 'odds-reliability',
      question: t('reliabilityQuestion', {
        siteName,
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: buildReliabilityAnswer(event, siteName, t),
    },
    {
      id: 'start-trading',
      question: t('startTradingQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: buildStartTradingAnswer(event, siteName, t),
    },
    {
      id: 'price-meaning',
      question: binaryEvent
        ? t('priceMeaningBinaryQuestion', {
            price: formatFaqCents(primarySelection.cents),
          })
        : t('priceMeaningMultiQuestion', {
            price: formatFaqCents(primarySelection.cents),
            selectionLabel: quoteLabel(primarySelection.label, t),
          }),
      answer: binaryEvent
        ? buildPriceMeaningBinaryAnswer(event, siteName, t)
        : buildPriceMeaningMultiAnswer(event, siteName, t),
    },
    {
      id: 'close-time',
      question: t('closeTimeQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: buildCloseAnswer(event, t),
    },
    {
      id: 'traders-saying',
      question: t('tradersSayingQuestion', {
        eventTitle: quoteLabel(event.title, t),
      }),
      answer: buildTradersSayingAnswer(event, commentsCount, t),
    },
    {
      id: 'what-is-site',
      question: t('whatIsSiteQuestion', { siteName }),
      answer: buildWhatIsSiteAnswer(siteName, event.title, t),
    },
  ]
}
