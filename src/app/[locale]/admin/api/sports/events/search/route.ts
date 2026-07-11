import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UserRepository } from '@/lib/db/queries/user'
import { findSportsEvents } from '@/lib/sports-source'
import { resolveSportsSourceProviderParam } from '@/lib/sports-source/providers'
import { loadSportsSourceProviderSettings } from '@/lib/sports-source/settings'

const searchSchema = z.object({
  q: z.string().trim().optional(),
  sport: z.string().trim().optional(),
  league: z.string().trim().optional(),
  series: z.string().trim().optional(),
  date: z.string().trim().optional(),
  category: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(25).optional(),
})

async function requireAdmin() {
  const currentUser = await UserRepository.getCurrentUser({ minimal: true })
  return Boolean(currentUser?.is_admin)
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const parsed = searchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const settings = await loadSportsSourceProviderSettings()
    const providerResolution = resolveSportsSourceProviderParam(parsed.data)
    if (providerResolution.error) {
      return NextResponse.json({ error: providerResolution.error }, { status: 400 })
    }

    const candidates = await findSportsEvents({
      title: parsed.data.q,
      sport: parsed.data.sport,
      league: parsed.data.league,
      series: parsed.data.series,
      date: parsed.data.date,
      category: parsed.data.category,
      limit: parsed.data.limit,
      provider: providerResolution.provider,
      auth: settings,
    })
    return NextResponse.json({ candidates }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }
  catch (error) {
    console.error('Sports event search failed:', error)
    return NextResponse.json({ error: 'Failed to search sports events.' }, { status: 500 })
  }
}
