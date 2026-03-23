import type { NextRequest } from 'next/server'
import type { EventCreationAssetPayload } from '@/lib/event-creation'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventCreationRepository } from '@/lib/db/queries/event-creations'
import { UserRepository } from '@/lib/db/queries/user'
import { buildDefaultDeployAt, buildImmediateDeployAt } from '@/lib/event-creation'

const createDraftSchema = z.object({
  mode: z.enum(['single', 'recurring']),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  sourceEventId: z.string().trim().length(26).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const search = new URL(request.url).searchParams.get('search')?.trim() || undefined
    const { data, error } = await EventCreationRepository.listDraftSummariesByUser({
      userId: currentUser.id,
      search,
      statuses: ['draft', 'scheduled', 'running', 'failed'],
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ data })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        error: DEFAULT_ERROR_MESSAGE,
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {}),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = createDraftSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null
    if (startAt && Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 })
    }
    if (startAt && !parsed.data.sourceEventId && startAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Resolution date must be in the future for new drafts.' }, { status: 400 })
    }

    let sourceTitle: string | undefined
    let sourceSlug: string | undefined
    let sourceEndDate: Date | null = null
    let sourceDraftPayload: Record<string, unknown> | null = null
    let sourceAssetPayload: EventCreationAssetPayload | null = null
    let sourceMainCategorySlug: string | null = null
    let sourceCategorySlugs: string[] = []
    if (parsed.data.sourceEventId) {
      const sourceResult = await EventCreationRepository.getCopySourceEvent({
        eventId: parsed.data.sourceEventId,
      })
      if (sourceResult.error || !sourceResult.data) {
        return NextResponse.json({ error: sourceResult.error ?? 'Event not found.' }, { status: 404 })
      }

      sourceTitle = sourceResult.data.title
      sourceSlug = `${sourceResult.data.slug}-copy`
      sourceEndDate = sourceResult.data.endDate
      sourceMainCategorySlug = sourceResult.data.mainCategorySlug
      sourceCategorySlugs = sourceResult.data.categories.map(item => item.slug)
      sourceAssetPayload = sourceResult.data.assetPayload
      sourceDraftPayload = {
        form: {
          title: sourceResult.data.title,
          slug: sourceSlug,
          endDateIso: sourceResult.data.endDate?.toISOString() ?? '',
          mainCategorySlug: sourceResult.data.mainCategorySlug ?? '',
          categories: sourceResult.data.categories,
          resolutionRules: sourceResult.data.rules ?? '',
        },
      }
    }

    const resolvedStartAt = startAt ?? sourceEndDate

    const { data, error } = await EventCreationRepository.createDraft({
      createdByUserId: currentUser.id,
      creationMode: parsed.data.mode,
      title: sourceTitle,
      slug: sourceSlug,
      startAt: resolvedStartAt,
      deployAt: parsed.data.mode === 'recurring'
        ? buildImmediateDeployAt(Date.now())
        : buildDefaultDeployAt(resolvedStartAt),
      endDate: sourceEndDate,
      sourceEventId: parsed.data.sourceEventId ?? null,
      draftPayload: sourceDraftPayload,
      assetPayload: sourceAssetPayload,
      mainCategorySlug: sourceMainCategorySlug,
      categorySlugs: sourceCategorySlugs,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        error: DEFAULT_ERROR_MESSAGE,
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {}),
      },
      { status: 500 },
    )
  }
}
