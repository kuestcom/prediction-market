import type { SupportedLocale } from '@/i18n/locales'
import type { MarketContextSettings } from '@/lib/ai/market-context-config'
import type { OpenRouterMessage } from '@/lib/ai/openrouter'
import type { Event, Market, Outcome } from '@/types'
import { DEFAULT_LOCALE, LOCALE_LABELS, SUPPORTED_LOCALES } from '@/i18n/locales'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion, sanitizeForPrompt } from '@/lib/ai/openrouter'
import { formatCentsLabel, formatCurrency as formatUsd } from '@/lib/formatters'

function formatPercent(value: number | null | undefined, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'unknown'
  }

  const normalized = value > 1 ? value : value * 100

  return `${normalized.toFixed(digits)}%`
}

function formatCurrencyValue(value: number | null | undefined, digits = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'unknown'
  }
  return formatUsd(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatSharePrice(value: number | null | undefined) {
  return formatCentsLabel(value, { fallback: 'unknown' })
}

function formatOutcome(outcome: Outcome) {
  const buyPrice = formatSharePrice(outcome.buy_price)
  const sellPrice = formatSharePrice(outcome.sell_price)

  return `- ${sanitizeForPrompt(outcome.outcome_text)}: buy ${buyPrice}, sell ${sellPrice}`
}

function resolveEstimatedEndDate(market: Market) {
  const metadata = (market.metadata ?? {}) as Record<string, any>

  const rawCandidate = (
    metadata.estimated_end_date
    || metadata.estimatedEndDate
    || metadata.end_date
    || metadata.endDate
    || metadata.expiry
    || metadata.expiry_date
    || metadata.expires_at
    || metadata.resolution_date
    || metadata.close_date
    || metadata.closeDate
  )

  const candidates = [
    typeof rawCandidate === 'string' ? rawCandidate : undefined,
    typeof metadata.end_timestamp === 'string' ? metadata.end_timestamp : undefined,
    market.condition?.resolved_at,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const date = new Date(candidate)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return 'Not provided'
}

function buildMarketContextVariables(event: Event, market: Market) {
  const outcomes = market.outcomes?.map(formatOutcome).join('\n') || '- No outcome information provided.'
  const estimatedEndDate = resolveEstimatedEndDate(market)

  return {
    'event-title': sanitizeForPrompt(event.title),
    'event-description': sanitizeForPrompt(event.rules),
    'event-main-tag': sanitizeForPrompt(event.main_tag),
    'event-creator': sanitizeForPrompt(event.creator),
    'event-created-at': sanitizeForPrompt(event.created_at),
    'market-estimated-end-date': sanitizeForPrompt(estimatedEndDate),
    'market-title': sanitizeForPrompt(market.title),
    'market-probability': formatPercent(market.probability),
    'market-price': formatSharePrice(market.price),
    'market-volume-24h': formatCurrencyValue(market.volume_24h, 2),
    'market-volume-total': formatCurrencyValue(market.volume, 2),
    'market-outcomes': outcomes,
  }
}

function applyPromptTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\[([a-z0-9-]+)\]/gi, (match, key) => {
    const normalized = key.toLowerCase()
    return Object.prototype.hasOwnProperty.call(variables, normalized)
      ? variables[normalized]
      : match
  })
}

function normalizeLocale(locale?: string): SupportedLocale {
  if (!locale) {
    return DEFAULT_LOCALE
  }

  const normalized = locale.toLowerCase()
  if (SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale
  }

  const base = normalized.split('-')[0]
  if (SUPPORTED_LOCALES.includes(base as SupportedLocale)) {
    return base as SupportedLocale
  }

  return DEFAULT_LOCALE
}

export async function generateMarketContext(
  event: Event,
  market: Market,
  providedSettings?: MarketContextSettings,
  locale?: string,
) {
  const settings = providedSettings ?? await loadMarketContextSettings()
  const { prompt, model, apiKey } = settings

  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured.')
  }

  const variables = buildMarketContextVariables(event, market)
  const userPrompt = applyPromptTemplate(prompt, variables)
  const resolvedLocale = normalizeLocale(locale)
  const localeInstruction = `Write the response in ${LOCALE_LABELS[resolvedLocale]} (locale: ${resolvedLocale}).`

  const systemMessage = [
    'You are a research assistant specializing in prediction markets.',
    'Blend on-chain trading data with timely news research to craft insightful market briefings.',
    'When the provided data is sparse, explicitly acknowledge the gap while focusing on actionable intelligence.',
    'Use neutral, professional tone. Avoid marketing language.',
    localeInstruction,
  ].join(' ')

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemMessage },
    {
      role: 'user',
      content: userPrompt,
    },
  ]

  const raw = await requestOpenRouterCompletion(messages, {
    model,
    apiKey,
  })
  return normalizeModelOutput(raw)
}

export function normalizeModelOutput(content: string) {
  return content
    .replace(/<\|begin[^>]*\|>/g, '')
    .replace(/<\|end[^>]*\|>/g, '')
    .replace(/<｜begin[^>]*｜>/g, '')
    .replace(/<｜end[^>]*｜>/g, '')
    .trim()
}
