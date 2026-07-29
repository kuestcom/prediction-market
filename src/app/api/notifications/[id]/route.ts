import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { NotificationRepository } from '@/lib/db/queries/notification'
import { UserRepository } from '@/lib/db/queries/user'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await UserRepository.getCurrentUser({ minimal: true })

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { id } = await params
    const { error } = await NotificationRepository.deleteById(id, user.id)

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
