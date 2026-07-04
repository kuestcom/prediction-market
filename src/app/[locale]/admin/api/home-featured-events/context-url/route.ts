import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UserRepository } from '@/lib/db/queries/user'
import {
  fetchHomeFeaturedNewsMetadata,
  HomeFeaturedNewsMetadataUrlError,
} from '@/lib/home-featured-context-metadata'

const RequestSchema = z.object({
  url: z.string().url().max(2048),
})

export async function POST(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = RequestSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid URL.' }, { status: 400 })
    }

    const metadata = await fetchHomeFeaturedNewsMetadata(parsed.data.url)
    return NextResponse.json({ item: metadata })
  }
  catch (error) {
    console.error('Failed to fetch featured news URL metadata', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not fetch URL metadata.' },
      { status: error instanceof HomeFeaturedNewsMetadataUrlError ? 400 : 500 },
    )
  }
}
