'use client'

import type { ReactNode } from 'react'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import { SiteIdentityContext } from '@/hooks/useSiteIdentity'

export default function SiteIdentityProvider({
  site,
  children,
}: {
  site: ThemeSiteIdentity
  children: ReactNode
}) {
  return <SiteIdentityContext value={site}>{children}</SiteIdentityContext>
}
