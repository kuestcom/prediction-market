import type { NextRequest } from 'next/server'
import { resolveSupportedLocale } from '@/i18n/locales'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import { IdentitySubmissionRepository } from '@/lib/db/queries/identity-submission'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { parseIdentitySettings } from '@/lib/identity/settings'

export async function GET(request: NextRequest) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return Response.json({ error: 'IDENTITY_UNAUTHENTICATED' }, { status: 401 })
  }
  const { data: settings } = await SettingsRepository.getSettings()
  const identityEnabled = parseIdentitySettings(settings).enabled
  if (!identityEnabled && !(await IdentityPrivacyRepository.hasUserFootprint(user.id))) {
    return new Response(null, { status: 404 })
  }
  const locale = resolveSupportedLocale(request.nextUrl.searchParams.get('locale'))
  const [programs, privacy] = await Promise.all([
    identityEnabled ? IdentitySubmissionRepository.getUserOverview(user.id, locale) : Promise.resolve([]),
    IdentityPrivacyRepository.listUserPrivacyState(user.id),
  ])
  return Response.json({ programs, privacy }, {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
