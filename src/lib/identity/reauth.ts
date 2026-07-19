import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import 'server-only'

const RECENT_AUTHENTICATION_MS = 15 * 60 * 1000

export async function assertRecentIdentityAuthentication(userId: string, requireTwoFactor = false) {
  const session = await auth.api.getSession({
    query: { disableCookieCache: true },
    headers: await headers(),
  })
  if (!session?.user || session.user.id !== userId) {
    throw new Error('IDENTITY_REAUTHENTICATION_REQUIRED')
  }
  const createdAt = new Date(session.session.createdAt)
  if (Number.isNaN(createdAt.getTime()) || createdAt.getTime() + RECENT_AUTHENTICATION_MS < Date.now()) {
    throw new Error('IDENTITY_REAUTHENTICATION_REQUIRED')
  }
  const user = session.user as typeof session.user & { twoFactorEnabled?: boolean, two_factor_enabled?: boolean }
  if (requireTwoFactor && user.twoFactorEnabled !== true && user.two_factor_enabled !== true) {
    throw new Error('IDENTITY_ADMIN_TWO_FACTOR_REQUIRED')
  }
}
