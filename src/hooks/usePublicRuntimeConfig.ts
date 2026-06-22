'use client'

import type { PublicRuntimeConfig } from '@/lib/public-runtime-config'
import { createContext, use } from 'react'

const defaultPublicRuntimeConfig: PublicRuntimeConfig = {
  reownAppKitProjectId: '',
  sentryDsn: '',
  siteUrl: 'http://localhost:3000',
}

export const PublicRuntimeConfigContext = createContext<PublicRuntimeConfig>(defaultPublicRuntimeConfig)

export function usePublicRuntimeConfig() {
  return use(PublicRuntimeConfigContext)
}
