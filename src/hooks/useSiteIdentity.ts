'use client'

import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import { createContext, use } from 'react'
import { createDefaultThemeSiteIdentity } from '@/lib/theme-site-identity'

export const SiteIdentityContext = createContext<ThemeSiteIdentity>(createDefaultThemeSiteIdentity())

export function useSiteIdentity() {
  return use(SiteIdentityContext)
}
