import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion, sanitizeForPrompt } from '@/lib/ai/openrouter'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { fetchHomeFeaturedNewsMetadata } from '@/lib/home-featured-context-metadata'

const RequestSchema = z.object({
  title: z.string().min(3).max(240),
  slug: z.string().max(240).optional().nullable(),
  newsSources: z.string().max(5000).optional().nullable(),
})

interface AiNewsResult {
  title?: string
  source?: string
  url?: string
  publishedAt?: string | null
}

function parseAiNewsResults(value: string): AiNewsResult[] {
  const jsonCandidate = value.trim().startsWith('{')
    ? value.trim()
    : value.match(/\{[\s\S]*\}/)?.[0] ?? ''
  if (!jsonCandidate) {
    return []
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as { news?: unknown }
    return Array.isArray(parsed.news) ? parsed.news as AiNewsResult[] : []
  }
  catch {
    return []
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = RequestSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const { data: allSettings } = await SettingsRepository.getSettings()
    const openRouter = parseOpenRouterProviderSettings(allSettings ?? undefined)
    if (!openRouter.apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key is not configured.' }, { status: 400 })
    }

    const prompt = [
      'Find recent news article URLs that explain the real-world topic behind one prediction market home context card.',
      'Use live web search. Return JSON only with this shape: {"news":[{"title":"article headline","source":"publisher","url":"https://...","publishedAt":"2026-07-04T12:00:00Z"}]}',
      'Critical relevance rules:',
      '- The phrase "prediction market" describes our product only. Do not search for or return articles about prediction markets, betting, exchanges, Polymarket, Kalshi, regulation, or the app itself unless the event title is explicitly about those things.',
      '- Search for the event title, named entities, and close real-world variants. For yes/no markets, look for reporting that helps understand the likelihood of the event outcome.',
      '- Treat source hints as publication/domain hints. If a hint is an RSS feed, homepage, sitemap, or section URL, infer the publication/domain and search broadly within or around that source.',
      '- Prefer directly relevant article pages published recently. Avoid homepages, RSS feeds, search pages, tag pages, and social profile pages.',
      '- Before returning a result, verify it is about the event topic itself and not generic prediction-market industry news.',
      '- Do not invent URLs. Return at most 6 results.',
      `Event title: ${parsed.data.title}`,
      `Event slug: ${parsed.data.slug ?? 'Not provided'}`,
      `Source hints: ${parsed.data.newsSources ?? 'Not provided'}`,
    ].join('\n\n')

    const content = await requestOpenRouterCompletion([
      {
        role: 'system',
        content: 'You are a careful news researcher. Return compact valid JSON only. Relevance is more important than count.',
      },
      {
        role: 'user',
        content: sanitizeForPrompt(prompt),
      },
    ], {
      apiKey: openRouter.apiKey,
      model: openRouter.model,
      temperature: 0.1,
      maxTokens: 900,
      webSearch: true,
    })

    const rawResults = parseAiNewsResults(content)
    const seenUrls = new Set<string>()
    const metadataResults = await Promise.allSettled(
      rawResults
        .filter(item => item.url?.trim())
        .slice(0, 6)
        .map(async (item) => {
          const metadata = await fetchHomeFeaturedNewsMetadata(item.url!)
          return {
            ...metadata,
            title: item.title?.trim() || metadata.title,
            source: item.source?.trim() || metadata.source,
            publishedAt: item.publishedAt ?? metadata.publishedAt,
          }
        }),
    )
    const items = metadataResults.flatMap((result) => {
      if (result.status !== 'fulfilled') {
        return []
      }
      if (seenUrls.has(result.value.url)) {
        return []
      }

      seenUrls.add(result.value.url)
      return [result.value]
    })

    return NextResponse.json({ items })
  }
  catch (error) {
    console.error('Failed to find featured context news', error)
    return NextResponse.json({ error: 'Could not find news for this featured market.' }, { status: 500 })
  }
}
