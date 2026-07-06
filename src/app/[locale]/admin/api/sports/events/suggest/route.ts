import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UserRepository } from '@/lib/db/queries/user'
import { suggestSportsEvents } from '@/lib/sports-source'
import { loadSportsSourceProviderSettings } from '@/lib/sports-source/settings'

const suggestSchema = z.object({
  title: z.string().trim().optional(),
  question: z.string().trim().optional(),
  outcomes: z.array(z.string()).optional(),
  description: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().trim().optional(),
  date: z.string().trim().optional(),
  sport: z.string().trim().optional(),
  league: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(25).optional(),
}).refine(value => Boolean(value.title || value.question || value.slug || value.outcomes?.length), {
  message: 'Market content is required.',
})

function resolveProviderParam(input: { provider?: string, category?: string, tags?: string[] }) {
  const explicitProvider = input.provider?.trim()
  if (explicitProvider) {
    return explicitProvider
  }

  const normalizedTags = new Set((input.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean))
  const category = input.category?.trim().toLowerCase()
  if (category === 'esports' || normalizedTags.has('esports')) {
    return 'pandascore'
  }
  if (category === 'sports' || normalizedTags.has('sports')) {
    return 'thesportsdb,sportmonks'
  }

  return undefined
}

async function requireAdmin() {
  const currentUser = await UserRepository.getCurrentUser({ minimal: true })
  return Boolean(currentUser?.is_admin)
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = suggestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const settings = await loadSportsSourceProviderSettings()
    const candidates = await suggestSportsEvents({
      ...parsed.data,
      provider: resolveProviderParam(parsed.data),
      auth: settings,
    })
    return NextResponse.json({ candidates }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }
  catch (error) {
    console.error('Sports event suggestion failed:', error)
    return NextResponse.json({ error: 'Failed to suggest sports event.' }, { status: 500 })
  }
}
