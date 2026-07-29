import { NextResponse } from 'next/server'
import { z } from 'zod'

import { UserRepository } from '@/lib/db/queries/user'
import { resolveSportsEvent } from '@/lib/sports-source'
import { loadSportsSourceProviderSettings } from '@/lib/sports-source/settings'

const resolveSchema = z
  .object({
    provider: z.string().trim().optional(),
    eventId: z.string().trim().optional(),
    gameId: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.eventId || value.gameId), {
    message: 'eventId or gameId is required.',
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

    const parsed = resolveSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const settings = await loadSportsSourceProviderSettings()
    const candidate = await resolveSportsEvent({
      ...parsed.data,
      auth: settings,
    })
    if (!candidate) {
      return NextResponse.json(
        { candidate: null },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    return NextResponse.json(
      { candidate },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('Sports event resolve failed:', error)
    return NextResponse.json({ error: 'Failed to resolve sports event.' }, { status: 500 })
  }
}
