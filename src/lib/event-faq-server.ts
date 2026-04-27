import type { SupportedLocale } from '@/i18n/locales'
import type { EventFaqItem } from '@/lib/event-faq'
import type { Event } from '@/types'
import { getExtracted } from 'next-intl/server'
import { buildEventFaqItems, createEventFaqTranslator } from '@/lib/event-faq'
import 'server-only'

interface BuildTranslatedEventFaqItemsOptions {
  event: Event
  siteName: string
  locale: SupportedLocale
  commentsCount?: number | null
}

export async function buildTranslatedEventFaqItems({
  event,
  siteName,
  locale,
  commentsCount,
}: BuildTranslatedEventFaqItemsOptions): Promise<EventFaqItem[]> {
  const t = await getExtracted({ locale })
  const faqTranslator = createEventFaqTranslator({
    thisMarket: t('this market'),
    thisOutcome: t('this outcome'),
    yesOutcome: t('Yes'),
    choiceSummary: t('{label} at {price} ({probability} implied probability)', {
      label: '{label}',
      price: '{price}',
      probability: '{probability}',
    }),
    siteAccuracySentence: t(' Prediction markets like {siteName} tend to become more informative as events approach resolution and more traders participate.', {
      siteName: '{siteName}',
    }),
    whatIsBinaryAnswer: t('{eventTitle} is a prediction market on {siteName} where traders buy and sell "Yes" or "No" shares based on whether they believe this event will happen. The current crowd-sourced probability is {probability} for "Yes." For example, if "Yes" is priced at {price}, the market collectively assigns a {probability} chance that this event will occur. These odds shift continuously as traders react to new developments and information. Shares in the correct outcome are redeemable for $1 each upon market resolution.', {
      eventTitle: '{eventTitle}',
      siteName: '{siteName}',
      probability: '{probability}',
      price: '{price}',
    }),
    leadingOutcomeSentence: t(' The current leading outcome is {choice}.', {
      choice: '{choice}',
    }),
    nextClosestOutcomeSentence: t(' The next closest outcome is {choice}.', {
      choice: '{choice}',
    }),
    whatIsMultiAnswer: t('{eventTitle} is a prediction market on {siteName} with {outcomesCount} possible outcomes where traders buy and sell shares based on what they believe will happen.{leaderSentence}{runnerUpSentence} Prices reflect real-time crowd-sourced probabilities. For example, a share priced at {price} implies that the market collectively assigns a {probability} chance to that outcome. These odds shift continuously as traders react to new developments and information. Shares in the correct outcome are redeemable for $1 each upon market resolution.', {
      eventTitle: '{eventTitle}',
      siteName: '{siteName}',
      outcomesCount: '{outcomesCount}',
      leaderSentence: '{leaderSentence}',
      runnerUpSentence: '{runnerUpSentence}',
      price: '{price}',
      probability: '{probability}',
    }),
    launchedOnDate: t(', launched on {date}', {
      date: '{date}',
    }),
    lowVolumeAnswer: t('{eventTitle} is a newly created market{launchedText}. As an early market, this is your opportunity to be among the first traders to set the odds and establish the market\'s initial price signals. You can also bookmark this page to track volume and trading activity as the market gains traction over time.', {
      eventTitle: '{eventTitle}',
      launchedText: '{launchedText}',
    }),
    sinceMarketLaunchedOnDate: t(' since the market launched on {date}', {
      date: '{date}',
    }),
    standardVolumeAnswer: t('As of today, {eventTitle} has generated {volume} in total trading volume{launchedText}. This level of trading activity reflects strong engagement from the {siteName} community and helps ensure that the current odds are informed by a deep pool of market participants. You can track live price movements and trade on any outcome directly on this page.', {
      eventTitle: '{eventTitle}',
      volume: '{volume}',
      launchedText: '{launchedText}',
      siteName: '{siteName}',
    }),
    tradeBinaryAnswer: t('To trade on {eventTitle}, simply choose whether you believe the answer will be "Yes" or "No." Each side has a current price that reflects the market\'s implied probability. Enter your amount and click "Trade." If you buy "Yes" shares and the outcome resolves as "Yes," each share pays out $1. If it resolves as "No," your "Yes" shares pay out $0. You can also sell your shares at any time before resolution if you want to lock in a profit or cut a loss.', {
      eventTitle: '{eventTitle}',
    }),
    tradeMultiAnswer: t('To trade on {eventTitle}, browse the {outcomesCount} available outcomes listed on this page. Each outcome displays a current price representing the market\'s implied probability. To take a position, select the outcome you believe is most likely, choose "Yes" to trade in favor of it or "No" to trade against it, enter your amount, and click "Trade." If your chosen outcome is correct when the market resolves, your "Yes" shares pay out $1 each. If it is incorrect, they pay out $0. You can also sell your shares at any time before resolution if you want to lock in a profit or cut a loss.', {
      eventTitle: '{eventTitle}',
      outcomesCount: '{outcomesCount}',
    }),
    currentOddsBinaryAnswer: t('The current probability for {eventTitle} is {probability} for "Yes." This means the {siteName} crowd currently believes there is a {probability} chance that this event will occur. These odds update in real-time based on actual trades, providing a continuously updated signal of what the market expects to happen.', {
      eventTitle: '{eventTitle}',
      probability: '{probability}',
      siteName: '{siteName}',
    }),
    currentFrontrunnerSentence: t('The current frontrunner for {eventTitle} is {choice}, meaning the market assigns a {probability} chance to that outcome.', {
      eventTitle: '{eventTitle}',
      choice: '{choice}',
      probability: '{probability}',
    }),
    currentPricesUpdateSentence: t('The current prices for {eventTitle} update in real time on this page.', {
      eventTitle: '{eventTitle}',
    }),
    currentOddsMultiAnswer: t('{leaderSentence}{runnerUpSentence} These odds update in real-time as traders buy and sell shares, so they reflect the latest collective view of what is most likely to happen. Check back frequently or bookmark this page to follow how the odds shift as new information emerges.', {
      leaderSentence: '{leaderSentence}',
      runnerUpSentence: '{runnerUpSentence}',
    }),
    resolutionAnswer: t('The resolution rules for {eventTitle} define exactly what needs to happen for each outcome to be declared a winner, including the official data sources used to determine the result. You can review the complete resolution criteria in the "Rules" section on this page above the comments. We recommend reading the rules carefully before trading, as they specify the precise conditions, edge cases, and sources that govern how this market is settled.', {
      eventTitle: '{eventTitle}',
    }),
    followAnswer: t('Yes. You don\'t need to trade to stay informed. This page serves as a live tracker for {eventTitle}. The outcome probabilities update in real-time as new trades come in. You can bookmark this page and check the comments section to see what other traders are saying. You can also use the time-range filters on the chart to see how the odds have shifted over time. It\'s a free, real-time window into what the market expects to happen.', {
      eventTitle: '{eventTitle}',
    }),
    reliabilityAnswer: t('{siteName} odds are set by real traders putting real money behind their beliefs, which tends to surface accurate predictions. With {volume} traded on {eventTitle}, these prices aggregate the collective knowledge and conviction of thousands of participants, often outperforming polls, expert forecasts, and traditional surveys.{accuracySentence}', {
      siteName: '{siteName}',
      volume: '{volume}',
      eventTitle: '{eventTitle}',
      accuracySentence: '{accuracySentence}',
    }),
    startTradingAnswer: t('To place your first trade on {eventTitle}, sign up for a free {siteName} account and fund it using crypto, a credit or debit card, or a bank transfer. Once your account is funded, return to this page, select the outcome you want to trade, enter your amount, and click "Trade." If you are new to prediction markets, click the "How it works" link at the top of any {siteName} page for a quick step-by-step walkthrough of how trading works.', {
      eventTitle: '{eventTitle}',
      siteName: '{siteName}',
    }),
    priceMeaningBinaryAnswer: t('On {siteName}, the price of "Yes" or "No" represents the market\'s implied probability. A "Yes" price of {price} for {eventTitle} means traders collectively believe there is a {probability} chance this event will happen. If you buy "Yes" at {price} and the event does happen, you receive $1.00 per share — a profit of {profit} per share. If the event doesn\'t happen, those shares are worth $0.', {
      siteName: '{siteName}',
      price: '{price}',
      eventTitle: '{eventTitle}',
      probability: '{probability}',
      profit: '{profit}',
    }),
    priceMeaningMultiAnswer: t('On {siteName}, the price of each outcome represents the market\'s implied probability. A price of {price} for {selectionLabel} in the {eventTitle} market means traders collectively believe there is roughly a {probability} chance that {selectionLabel} will be the correct result. If you buy "Yes" shares at {price} and the outcome is correct, you receive $1.00 per share — a profit of {profit} per share. If incorrect, those shares are worth $0.', {
      siteName: '{siteName}',
      price: '{price}',
      selectionLabel: '{selectionLabel}',
      eventTitle: '{eventTitle}',
      probability: '{probability}',
      profit: '{profit}',
    }),
    resolvedCloseAnswer: t('The {eventTitle} market has been resolved. The final result has been determined and the market is no longer open for trading. You can still review the historical odds, outcome probabilities, and comments on this page to see how predictions evolved over time.', {
      eventTitle: '{eventTitle}',
    }),
    openCloseAnswer: t('The {eventTitle} market remains open until the official result becomes available and the market can be settled under the rules on this page.', {
      eventTitle: '{eventTitle}',
    }),
    scheduledCloseAnswer: t('The {eventTitle} market is scheduled to resolve on or around {closeDate}. This means trading will remain open and the odds will continue to shift as new information emerges until that date. The exact resolution timing depends on when the official result becomes available, as outlined in the "Rules" section on this page.', {
      eventTitle: '{eventTitle}',
      closeDate: '{closeDate}',
    }),
    activeCommentsAnswer: t('The {eventTitle} market has an active community of {commentsCount} comments where traders share their analysis, debate outcomes, and discuss breaking developments. Scroll down to the comments section below to read what other participants think. You can also filter by "Top Holders" to see what the market\'s biggest traders are positioned on, or check the "Activity" tab for a real-time feed of trades.', {
      eventTitle: '{eventTitle}',
      commentsCount: '{commentsCount}',
    }),
    lowCommentsAnswer: t('The {eventTitle} market was recently created. Be one of the first to share your analysis by posting a comment below, or check back as the market grows to read what other traders think. You can also view the "Activity" tab for a real-time feed of recent trades.', {
      eventTitle: '{eventTitle}',
    }),
    whatIsSiteAnswer: t('{siteName} is a prediction market platform where you can stay informed and trade on real-world events. Traders buy and sell shares on outcomes across politics, sports, crypto, finance, tech, and culture, including markets like {eventTitle}. Prices reflect real-time, crowd-sourced probabilities backed by real money, giving you a transparent market view of what participants expect to happen.', {
      siteName: '{siteName}',
      eventTitle: '{eventTitle}',
    }),
    whatIsQuestion: t('What is the {eventTitle} prediction market?', {
      eventTitle: '{eventTitle}',
    }),
    tradingActivityQuestion: t('How much trading activity has {eventTitle} generated on {siteName}?', {
      eventTitle: '{eventTitle}',
      siteName: '{siteName}',
    }),
    howToTradeQuestion: t('How do I trade on {eventTitle}?', {
      eventTitle: '{eventTitle}',
    }),
    currentOddsQuestion: t('What are the current odds for {eventTitle}?', {
      eventTitle: '{eventTitle}',
    }),
    resolutionQuestion: t('How will {eventTitle} be resolved?', {
      eventTitle: '{eventTitle}',
    }),
    followQuestion: t('Can I follow {eventTitle} without placing a trade?', {
      eventTitle: '{eventTitle}',
    }),
    reliabilityQuestion: t('Why are {siteName}\'s odds for {eventTitle} considered reliable?', {
      siteName: '{siteName}',
      eventTitle: '{eventTitle}',
    }),
    startTradingQuestion: t('How do I start trading on {eventTitle}?', {
      eventTitle: '{eventTitle}',
    }),
    priceMeaningBinaryQuestion: t('What does a price of {price} for "Yes" mean?', {
      price: '{price}',
    }),
    priceMeaningMultiQuestion: t('What does a price of {price} for {selectionLabel} mean?', {
      price: '{price}',
      selectionLabel: '{selectionLabel}',
    }),
    closeTimeQuestion: t('When does the {eventTitle} market close?', {
      eventTitle: '{eventTitle}',
    }),
    tradersSayingQuestion: t('What are traders saying about {eventTitle}?', {
      eventTitle: '{eventTitle}',
    }),
    whatIsSiteQuestion: t('What is {siteName}?', {
      siteName: '{siteName}',
    }),
  })

  return buildEventFaqItems({
    event,
    siteName,
    commentsCount,
    translate: faqTranslator,
  })
}
