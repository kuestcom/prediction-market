'use client'

import type { PublicRuntimeConfig } from '@/lib/public-runtime-config.shared'
import { createContext, use } from 'react'
import { defaultPublicRuntimeConfig } from '@/lib/public-runtime-config.shared'

export const PublicRuntimeConfigContext = createContext<PublicRuntimeConfig>(defaultPublicRuntimeConfig)

export function usePublicRuntimeConfig() {
  return use(PublicRuntimeConfigContext)
}
