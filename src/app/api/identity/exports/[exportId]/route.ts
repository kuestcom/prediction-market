import type { NextRequest } from 'next/server'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import { UserRepository } from '@/lib/db/queries/user'
import { assertRecentIdentityAuthentication } from '@/lib/identity/reauth'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ exportId: string }> }) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return new Response(null, { status: 401 })
  }
  try {
    await assertRecentIdentityAuthentication(user.id)
  }
  catch {
    return Response.json({ error: 'IDENTITY_REAUTHENTICATION_REQUIRED' }, { status: 403 })
  }
  const { exportId } = await params
  const result = await IdentityPrivacyRepository.downloadExport(user.id, exportId)
  if (!result) {
    return new Response(null, { status: 404 })
  }
  return new Response(result.bytes, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
