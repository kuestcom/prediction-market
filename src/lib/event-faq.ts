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
}

interface FaqSelection {
  label: string
  cents: number
}

const LOW_VOLUME_THRESHOLD = 10_000
const ACTIVE_COMMENTS_THRESHOLD = 10
const CENTS_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function quoteLabel(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? `"${normalized}"` : '"this market"'
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

function resolveMarketLabel(market: Market) {
  return market.short_title?.trim() || market.title?.trim() || 'this outcome'
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

function resolveBinarySelection(event: Event): FaqSelection {
  return {
    label: 'Yes',
    cents: resolveBinaryYesCents(event),
  }
}

function resolveFrontRunnerSelections(event: Event) {
  return Array.from(event.markets, market => ({
    label: resolveMarketLabel(market),
    cents: resolveMarketPriceCents(market),
  }))
    .sort((left, right) => right.cents - left.cents)
}

function resolvePrimarySelection(event: Event) {
  if (isBinaryEvent(event)) {
    return resolveBinarySelection(event)
  }

  return resolveFrontRunnerSelections(event)[0] ?? {
    label: 'this outcome',
    cents: 50,
  }
}

function formatChoice(selection: FaqSelection) {
  return `${quoteLabel(selection.label)} at ${formatFaqCents(selection.cents)} (${formatPercentFromCents(selection.cents)} implied probability)`
}

function buildSiteAccuracySentence(siteName: string) {
  return ` Prediction markets like ${siteName} tend to become more informative as events approach resolution and more traders participate.`
}

function buildWhatIsBinaryAnswer(event: Event, siteName: string) {
  const yesSelection = resolveBinarySelection(event)

  return `${quoteLabel(event.title)} is a prediction market on ${siteName} where traders buy and sell "Yes" or "No" shares based on whether they believe this event will happen. The current crowd-sourced probability is ${formatPercentFromCents(yesSelection.cents)} for "Yes." For example, if "Yes" is priced at ${formatFaqCents(yesSelection.cents)}, the market collectively assigns a ${formatPercentFromCents(yesSelection.cents)} chance that this event will occur. These odds shift continuously as traders react to new developments and information. Shares in the correct outcome are redeemable for $1 each upon market resolution.`
}

function buildWhatIsMultiAnswer(event: Event, siteName: string) {
  const frontRunners = resolveFrontRunnerSelections(event)
  const leader = frontRunners[0] ?? null
  const runnerUp = frontRunners[1] ?? null
  const leaderSentence = leader
    ? ` The current leading outcome is ${formatChoice(leader)}.`
    : ''
  const runnerUpSentence = runnerUp
    ? ` The next closest outcome is ${formatChoice(runnerUp)}.`
    : ''
  const exampleSelection = leader ?? runnerUp ?? { label: 'this outcome', cents: 50 }

  return `${quoteLabel(event.title)} is a prediction market on ${siteName} with ${resolveTotalMarketsCount(event)} possible outcomes where traders buy and sell shares based on what they believe will happen.${leaderSentence}${runnerUpSentence} Prices reflect real-time crowd-sourced probabilities. For example, a share priced at ${formatFaqCents(exampleSelection.cents)} implies that the market collectively assigns a ${formatPercentFromCents(exampleSelection.cents)} chance to that outcome. These odds shift continuously as traders react to new developments and information. Shares in the correct outcome are redeemable for $1 each upon market resolution.`
}

function buildLowVolumeAnswer(event: Event) {
  const createdAtLabel = formatMonthDayYear(event.created_at)
  const launchedText = createdAtLabel ? `, launched on ${createdAtLabel}` : ''

  return `${quoteLabel(event.title)} is a newly created market${launchedText}. As an early market, this is your opportunity to be among the first traders to set the odds and establish the market's initial price signals. You can also bookmark this page to track volume and trading activity as the market gains traction over time.`
}

function buildStandardVolumeAnswer(event: Event, siteName: string) {
  const createdAtLabel = formatMonthDayYear(event.created_at)
  const launchedText = createdAtLabel ? ` since the market launched on ${createdAtLabel}` : ''

  return `As of today, ${quoteLabel(event.title)} has generated ${formatFaqCurrency(event.volume)} in total trading volume${launchedText}. This level of trading activity reflects strong engagement from the ${siteName} community and helps ensure that the current odds are informed by a deep pool of market participants. You can track live price movements and trade on any outcome directly on this page.`
}

function buildTradeBinaryAnswer(event: Event) {
  return `To trade on ${quoteLabel(event.title)}, simply choose whether you believe the answer will be "Yes" or "No." Each side has a current price that reflects the market's implied probability. Enter your amount and click "Trade." If you buy "Yes" shares and the outcome resolves as "Yes," each share pays out $1. If it resolves as "No," your "Yes" shares pay out $0. You can also sell your shares at any time before resolution if you want to lock in a profit or cut a loss.`
}

function buildTradeMultiAnswer(event: Event) {
  return `To trade on ${quoteLabel(event.title)}, browse the ${resolveTotalMarketsCount(event)} available outcomes listed on this page. Each outcome displays a current price representing the market's implied probability. To take a position, select the outcome you believe is most likely, choose "Yes" to trade in favor of it or "No" to trade against it, enter your amount, and click "Trade." If your chosen outcome is correct when the market resolves, your "Yes" shares pay out $1 each. If it is incorrect, they pay out $0. You can also sell your shares at any time before resolution if you want to lock in a profit or cut a loss.`
}

function buildCurrentOddsBinaryAnswer(event: Event, siteName: string) {
  const yesSelection = resolveBinarySelection(event)

  return `The current probability for ${quoteLabel(event.title)} is ${formatPercentFromCents(yesSelection.cents)} for "Yes." This means the ${siteName} crowd currently believes there is a ${formatPercentFromCents(yesSelection.cents)} chance that this event will occur. These odds update in real-time based on actual trades, providing a continuously updated signal of what the market expects to happen.`
}

function buildCurrentOddsMultiAnswer(event: Event) {
  const frontRunners = resolveFrontRunnerSelections(event)
  const leader = frontRunners[0] ?? null
  const runnerUp = frontRunners[1] ?? null
  const leaderSentence = leader
    ? `The current frontrunner for ${quoteLabel(event.title)} is ${formatChoice(leader)}, meaning the market assigns a ${formatPercentFromCents(leader.cents)} chance to that outcome.`
    : `The current prices for ${quoteLabel(event.title)} update in real time on this page.`
  const runnerUpSentence = runnerUp
    ? ` The next closest outcome is ${formatChoice(runnerUp)}.`
    : ''

  return `${leaderSentence}${runnerUpSentence} These odds update in real-time as traders buy and sell shares, so they reflect the latest collective view of what is most likely to happen. Check back frequently or bookmark this page to follow how the odds shift as new information emerges.`
}

function buildResolutionAnswer(event: Event) {
  return `The resolution rules for ${quoteLabel(event.title)} define exactly what needs to happen for each outcome to be declared a winner, including the official data sources used to determine the result. You can review the complete resolution criteria in the "Rules" section on this page above the comments. We recommend reading the rules carefully before trading, as they specify the precise conditions, edge cases, and sources that govern how this market is settled.`
}

function buildFollowAnswer(event: Event) {
  return `Yes. You don't need to trade to stay informed. This page serves as a live tracker for ${quoteLabel(event.title)}. The outcome probabilities update in real-time as new trades come in. You can bookmark this page and check the comments section to see what other traders are saying. You can also use the time-range filters on the chart to see how the odds have shifted over time. It's a free, real-time window into what the market expects to happen.`
}

function buildReliabilityAnswer(event: Event, siteName: string) {
  return `${siteName} odds are set by real traders putting real money behind their beliefs, which tends to surface accurate predictions. With ${formatFaqCurrency(event.volume)} traded on ${quoteLabel(event.title)}, these prices aggregate the collective knowledge and conviction of thousands of participants, often outperforming polls, expert forecasts, and traditional surveys.${buildSiteAccuracySentence(siteName)}`
}

function buildStartTradingAnswer(event: Event, siteName: string) {
  return `To place your first trade on ${quoteLabel(event.title)}, sign up for a free ${siteName} account and fund it using crypto, a credit or debit card, or a bank transfer. Once your account is funded, return to this page, select the outcome you want to trade, enter your amount, and click "Trade." If you are new to prediction markets, click the "How it works" link at the top of any ${siteName} page for a quick step-by-step walkthrough of how trading works.`
}

function buildPriceMeaningBinaryAnswer(event: Event, siteName: string) {
  const yesSelection = resolveBinarySelection(event)
  const profitCents = clampCents(100 - yesSelection.cents)

  return `On ${siteName}, the price of "Yes" or "No" represents the market's implied probability. A "Yes" price of ${formatFaqCents(yesSelection.cents)} for ${quoteLabel(event.title)} means traders collectively believe there is a ${formatPercentFromCents(yesSelection.cents)} chance this event will happen. If you buy "Yes" at ${formatFaqCents(yesSelection.cents)} and the event does happen, you receive $1.00 per share — a profit of ${formatFaqCents(profitCents)} per share. If the event doesn't happen, those shares are worth $0.`
}

function buildPriceMeaningMultiAnswer(event: Event, siteName: string) {
  const selection = resolvePrimarySelection(event)
  const profitCents = clampCents(100 - selection.cents)

  return `On ${siteName}, the price of each outcome represents the market's implied probability. A price of ${formatFaqCents(selection.cents)} for ${quoteLabel(selection.label)} in the ${quoteLabel(event.title)} market means traders collectively believe there is roughly a ${formatPercentFromCents(selection.cents)} chance that ${quoteLabel(selection.label)} will be the correct result. If you buy "Yes" shares at ${formatFaqCents(selection.cents)} and the outcome is correct, you receive $1.00 per share — a profit of ${formatFaqCents(profitCents)} per share. If incorrect, those shares are worth $0.`
}

function buildCloseAnswer(event: Event) {
  if (isResolvedEvent(event)) {
    return `The ${quoteLabel(event.title)} market has been resolved. The final result has been determined and the market is no longer open for trading. You can still review the historical odds, outcome probabilities, and comments on this page to see how predictions evolved over time.`
  }

  const closeDate = formatMonthDayYear(event.end_date ?? event.resolved_at ?? event.start_date)
  if (!closeDate) {
    return `The ${quoteLabel(event.title)} market remains open until the official result becomes available and the market can be settled under the rules on this page.`
  }

  return `The ${quoteLabel(event.title)} market is scheduled to resolve on or around ${closeDate}. This means trading will remain open and the odds will continue to shift as new information emerges until that date. The exact resolution timing depends on when the official result becomes available, as outlined in the "Rules" section on this page.`
}

function buildTradersSayingAnswer(event: Event, commentsCount: number | null | undefined) {
  if (commentsCount != null && Number.isFinite(commentsCount) && commentsCount >= ACTIVE_COMMENTS_THRESHOLD) {
    return `The ${quoteLabel(event.title)} market has an active community of ${formatCompactCount(commentsCount)} comments where traders share their analysis, debate outcomes, and discuss breaking developments. Scroll down to the comments section below to read what other participants think. You can also filter by "Top Holders" to see what the market's biggest traders are positioned on, or check the "Activity" tab for a real-time feed of trades.`
  }

  return `The ${quoteLabel(event.title)} market was recently created. Be one of the first to share your analysis by posting a comment below, or check back as the market grows to read what other traders think. You can also view the "Activity" tab for a real-time feed of recent trades.`
}

function buildWhatIsSiteAnswer(siteName: string, eventTitle: string) {
  return `${siteName} is a prediction market platform where you can stay informed and trade on real-world events. Traders buy and sell shares on outcomes across politics, sports, crypto, finance, tech, and culture, including markets like ${quoteLabel(eventTitle)}. Prices reflect real-time, crowd-sourced probabilities backed by real money, giving you a transparent market view of what participants expect to happen.`
}

export function buildEventFaqItems({
  event,
  siteName,
  commentsCount,
}: BuildEventFaqItemsOptions): EventFaqItem[] {
  const lowVolume = event.volume < LOW_VOLUME_THRESHOLD
  const binaryEvent = isBinaryEvent(event)
  const primarySelection = resolvePrimarySelection(event)

  return [
    {
      id: 'what-is',
      question: `What is the ${quoteLabel(event.title)} prediction market?`,
      answer: binaryEvent
        ? buildWhatIsBinaryAnswer(event, siteName)
        : buildWhatIsMultiAnswer(event, siteName),
    },
    {
      id: 'trading-activity',
      question: `How much trading activity has ${quoteLabel(event.title)} generated on ${siteName}?`,
      answer: lowVolume
        ? buildLowVolumeAnswer(event)
        : buildStandardVolumeAnswer(event, siteName),
    },
    {
      id: 'how-to-trade',
      question: `How do I trade on ${quoteLabel(event.title)}?`,
      answer: binaryEvent
        ? buildTradeBinaryAnswer(event)
        : buildTradeMultiAnswer(event),
    },
    {
      id: 'current-odds',
      question: `What are the current odds for ${quoteLabel(event.title)}?`,
      answer: binaryEvent
        ? buildCurrentOddsBinaryAnswer(event, siteName)
        : buildCurrentOddsMultiAnswer(event),
    },
    {
      id: 'resolution',
      question: `How will ${quoteLabel(event.title)} be resolved?`,
      answer: buildResolutionAnswer(event),
    },
    {
      id: 'follow-without-trade',
      question: `Can I follow ${quoteLabel(event.title)} without placing a trade?`,
      answer: buildFollowAnswer(event),
    },
    {
      id: 'odds-reliability',
      question: `Why are ${siteName}'s odds for ${quoteLabel(event.title)} considered reliable?`,
      answer: buildReliabilityAnswer(event, siteName),
    },
    {
      id: 'start-trading',
      question: `How do I start trading on ${quoteLabel(event.title)}?`,
      answer: buildStartTradingAnswer(event, siteName),
    },
    {
      id: 'price-meaning',
      question: binaryEvent
        ? `What does a price of ${formatFaqCents(primarySelection.cents)} for "Yes" mean?`
        : `What does a price of ${formatFaqCents(primarySelection.cents)} for ${quoteLabel(primarySelection.label)} mean?`,
      answer: binaryEvent
        ? buildPriceMeaningBinaryAnswer(event, siteName)
        : buildPriceMeaningMultiAnswer(event, siteName),
    },
    {
      id: 'close-time',
      question: `When does the ${quoteLabel(event.title)} market close?`,
      answer: buildCloseAnswer(event),
    },
    {
      id: 'traders-saying',
      question: `What are traders saying about ${quoteLabel(event.title)}?`,
      answer: buildTradersSayingAnswer(event, commentsCount),
    },
    {
      id: 'what-is-site',
      question: `What is ${siteName}?`,
      answer: buildWhatIsSiteAnswer(siteName, event.title),
    },
  ]
}
