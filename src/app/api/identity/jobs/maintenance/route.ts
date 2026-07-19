import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { runIdentityMaintenance } from '@/lib/identity/jobs'

export const maxDuration = 60

export async function POST(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.IDENTITY_MAINTENANCE_SECRET ?? process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }
  try {
    return NextResponse.json({ success: true, ...(await runIdentityMaintenance()) })
  }
  catch (error) {
    console.error('Identity maintenance failed', error)
    return NextResponse.json({ success: false, error: 'IDENTITY_MAINTENANCE_FAILED' }, { status: 500 })
  }
}
