import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventCreationRepository } from '@/lib/db/queries/event-creations'
import { UserRepository } from '@/lib/db/queries/user'
import { isSafeEventCreationAssetRecordKey, normalizeEventCreationAssetPayload } from '@/lib/event-creation'
import { getPublicAssetUrl, uploadPublicAsset } from '@/lib/storage'

interface EventCreationAssetRouteProps {
  params: Promise<{
    id: string
    locale: string
  }>
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveAssetExtension(file: File) {
  const nameParts = file.name.split('.')
  const rawExtension = nameParts.length > 1 ? (nameParts.at(-1) ?? '') : ''
  const normalized = rawExtension.trim().toLowerCase()
  return normalized || 'bin'
}

export async function POST(request: NextRequest, { params }: EventCreationAssetRouteProps) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { id } = await params
    const draftResult = await EventCreationRepository.getDraftByIdForUser({
      draftId: id,
      userId: currentUser.id,
    })
    if (draftResult.error || !draftResult.data) {
      return NextResponse.json({ error: draftResult.error ?? 'Draft not found.' }, { status: 404 })
    }

    const formData = await request.formData()
    const kind = String(formData.get('kind') ?? '').trim()
    const targetKey = sanitizeSegment(String(formData.get('targetKey') ?? ''))
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 })
    }

    if (kind !== 'eventImage' && kind !== 'optionImage' && kind !== 'teamLogo') {
      return NextResponse.json({ error: 'Invalid asset kind.' }, { status: 400 })
    }

    if (kind === 'optionImage' && !isSafeEventCreationAssetRecordKey(targetKey)) {
      return NextResponse.json({ error: 'Invalid option image target.' }, { status: 400 })
    }

    if (kind === 'teamLogo' && targetKey !== 'home' && targetKey !== 'away') {
      return NextResponse.json({ error: 'Invalid team logo target.' }, { status: 400 })
    }

    const extension = resolveAssetExtension(file)
    const fileName = kind === 'eventImage'
      ? `event-image-${Date.now()}.${extension}`
      : `${sanitizeSegment(kind)}-${targetKey || 'asset'}-${Date.now()}.${extension}`
    const storagePath = `event-creations/${id}/${fileName}`
    const buffer = new Uint8Array(await file.arrayBuffer())
    const uploadResult = await uploadPublicAsset(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: true,
    })
    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error }, { status: 500 })
    }

    const assetPayload = normalizeEventCreationAssetPayload(draftResult.data.assetPayload)
    const assetRef = {
      storagePath,
      publicUrl: getPublicAssetUrl(storagePath),
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    }

    if (kind === 'eventImage') {
      assetPayload.eventImage = assetRef
    }
    else if (kind === 'optionImage') {
      assetPayload.optionImages[targetKey] = assetRef
    }
    else if (kind === 'teamLogo') {
      assetPayload.teamLogos[targetKey as 'home' | 'away'] = assetRef
    }

    const updateResult = await EventCreationRepository.updateDraftCoreFields({
      draftId: id,
      userId: currentUser.id,
      updatedByUserId: currentUser.id,
      assetPayload,
    })
    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        asset: assetRef,
        assetPayload,
      },
    }, { status: 201 })
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
