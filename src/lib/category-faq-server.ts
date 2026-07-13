import type { SupportedLocale } from '@/i18n/locales'
import type { CategoryFaqContext, CategoryFaqMessageKey } from '@/lib/category-faq'
import { getExtracted } from 'next-intl/server'
import { buildCategoryFaqItems } from '@/lib/category-faq'
import 'server-only'

interface BuildTranslatedCategoryFaqItemsOptions extends CategoryFaqContext {
  locale: SupportedLocale
  siteName: string
}

export async function buildTranslatedCategoryFaqItems({
  locale,
  ...options
}: BuildTranslatedCategoryFaqItemsOptions) {
  const t = await getExtracted({ locale })
  const values = {
    categoryName: '{categoryName}',
    eventCount: '{eventCount}',
    marketCount: '{marketCount}',
    popularEvents: '{popularEvents}',
    siteName: '{siteName}',
    subcategories: '{subcategories}',
  }
  const messages: Record<CategoryFaqMessageKey, string> = {
    whatIsSiteQuestion: t('What is {siteName}?', values),
    whatIsSiteAnswer: t('{siteName} is a prediction market where users trade on real-world outcomes across {categoryName} and many other topics. Prices from 0 to 100 cents reflect the implied probability of an outcome, creating a real-time consensus backed by traders\' positions.', values),
    whatIsCategoryQuestion: t('What is a {categoryName} prediction market?', values),
    whatIsCategoryAnswer: t('A {categoryName} prediction market lets users trade shares on questions related to {categoryName}. Each winning share pays $1 when the result is confirmed, while losing shares pay $0. The current price reflects the probability traders assign to that outcome.', values),
    topicsQuestion: t('What topics can I trade in the {categoryName} category?', values),
    topicsAnswer: t('The {categoryName} category currently covers {eventCount} events and {marketCount} active markets. Topics include {subcategories}. Use the category navigation to explore live odds, volume, and active markets for each topic.', values),
    oddsQuestion: t('How do {categoryName} odds work on {siteName}?', values),
    oddsAnswer: t('Every {categoryName} outcome is priced between 0 and 100 cents. The price is the market\'s implied probability: a 65-cent share, for example, represents roughly a 65% chance. Prices update continuously as traders react to new information.', values),
    activeQuestion: t('Which {categoryName} markets are most active right now?', values),
    activeAnswer: t('Activity changes constantly, but you can sort this page by 24-hour volume to find where trading is concentrated. Markets currently drawing attention include {popularEvents}.', values),
    resolutionQuestion: t('How are {categoryName} prediction markets resolved?', values),
    resolutionAnswer: t('Each market has specific resolution criteria and sources published in its rules. Once the result is confirmed by the defined source, the market resolves and winning shares pay $1 each. Read the complete rules before trading.'),
    changesQuestion: t('Why do {categoryName} odds change so often?', values),
    changesAnswer: t('{categoryName} markets respond in real time to news, announcements, data, deadlines, and other developments. Each trade can move the price as participants update their views, so the displayed probability can change at any time.', values),
    countQuestion: t('How many {categoryName} markets are on {siteName}?', values),
    countAnswer: t('{siteName} currently lists {marketCount} active markets across {eventCount} events in the {categoryName} category. Counts update as markets open and resolve, and the category navigation shows the latest coverage by topic.', values),
    futureQuestion: t('Can I trade future {categoryName} events before they happen?', values),
    futureAnswer: t('Yes. Most prediction markets open before the underlying event, allowing you to take a position as information emerges. The available time horizon depends on each market\'s closing date and resolution rules.'),
    accuracyQuestion: t('Are {siteName}\'s {categoryName} odds more accurate than polls or forecasts?', values),
    accuracyAnswer: t('Prediction markets, polls, models, and analyst forecasts are complementary tools. Because traders risk capital, market prices aggregate their information and incentives into one probability. No market is a guarantee; odds show the consensus at a point in time.'),
    startQuestion: t('How do I start trading {categoryName} markets on {siteName}?', values),
    startAnswer: t('Browse the {categoryName} page, open a market to review its prices and full rules, and select the outcome you want to trade. Once your account is funded, enter an amount and place your order. You can sell before resolution or hold winning shares for the $1 payout.', values),
    movesQuestion: t('What moves {categoryName} prediction market prices?', values),
    movesAnswer: t('Prices are driven by developments related to the underlying event, including official announcements, scheduled dates, data releases, reporting, and major news. Buying and selling turn those changing views into updated implied probabilities.'),
    liveQuestion: t('Where can I see live {categoryName} odds and trading volume?', values),
    liveAnswer: t('Market cards on this page show current outcome probabilities and trading volume. Open any market for its price history, available outcomes, full resolution rules, and trading controls.'),
  }

  return buildCategoryFaqItems({
    ...options,
    translate: (key: CategoryFaqMessageKey, interpolationValues) => messages[key].replace(/\{(\w+)\}/g, (match, name) => (
      interpolationValues[name] == null ? match : String(interpolationValues[name])
    )),
  })
}
