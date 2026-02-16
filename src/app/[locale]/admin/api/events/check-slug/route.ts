import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

export async function GET(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawSlug = searchParams.get('slug')?.trim()

    if (!rawSlug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
    }

    const normalizedSlug = rawSlug.toLowerCase()

    const { data, error } = await EventRepository.existsBySlug(normalizedSlug)
    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json({ exists: data })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
