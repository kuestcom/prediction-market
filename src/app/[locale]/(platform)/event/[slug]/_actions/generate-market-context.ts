'use server'

import type { SupportedLocale } from '@/i18n/locales'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { generateMarketContext } from '@/lib/ai/market-context'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { MarketContextCacheRepository } from '@/lib/db/queries/market-context-cache'

const MARKET_CONTEXT_CACHE_WINDOW_MS = 30 * 60 * 1000

const GenerateMarketContextSchema = z.object({
  slug: z.string(),
  marketConditionId: z.string().optional(),
  readOnly: z.boolean().optional(),
})

type GenerateMarketContextInput = z.infer<typeof GenerateMarketContextSchema>

export async function generateMarketContextAction(input: GenerateMarketContextInput) {
  const parsed = GenerateMarketContextSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request.' }
  }

  try {
    const { slug, marketConditionId, readOnly = false } = parsed.data
    const locale = await getLocale()
    const resolvedLocale = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
      ? locale as SupportedLocale
      : DEFAULT_LOCALE
    const { data: event, error } = await EventRepository.getEventBySlug(slug, '', resolvedLocale)

    if (error || !event) {
      console.error('Failed to fetch event for market context.', error)
      return { error: 'Event could not be located.' }
    }

    const market = event.markets.find(candidate => candidate.condition_id === marketConditionId) ?? event.markets[0]

    if (!market) {
      return { error: 'No markets available for this event.' }
    }

    const cachedResult = await MarketContextCacheRepository.getValidContext(market.condition_id, resolvedLocale)

    if (cachedResult.error) {
      console.error('Failed to fetch cached market context.', cachedResult.error)
    }
    else if (cachedResult.data) {
      return {
        context: cachedResult.data.context,
        expiresAt: cachedResult.data.expiresAt,
        updatedAt: cachedResult.data.updatedAt,
        cached: true,
      }
    }

    if (readOnly) {
      return {
        context: null,
        expiresAt: null,
        updatedAt: null,
        cached: false,
      }
    }

    const settings = await loadMarketContextSettings()
    if (!settings.enabled || !settings.apiKey) {
      return { error: 'Market context generation is not configured.' }
    }

    const context = await generateMarketContext(event, market, settings, locale)
    const expiresAt = new Date(Date.now() + MARKET_CONTEXT_CACHE_WINDOW_MS)
    const persistedCache = await MarketContextCacheRepository.upsertContext(
      market.condition_id,
      resolvedLocale,
      context,
      expiresAt,
    )

    if (persistedCache.error) {
      console.error('Failed to persist market context cache.', persistedCache.error)
    }

    return {
      context,
      expiresAt: persistedCache.data?.expiresAt ?? expiresAt.toISOString(),
      updatedAt: persistedCache.data?.updatedAt ?? new Date().toISOString(),
      cached: false,
    }
  }
  catch (error) {
    console.error('Failed to generate market context.', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
