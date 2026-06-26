'use client'

import type { ReactNode } from 'react'
import type { PublicRuntimeConfig } from '@/lib/public-runtime-config.shared'
import { PublicRuntimeConfigContext } from '@/hooks/usePublicRuntimeConfig'

export default function PublicRuntimeConfigProvider({
  config,
  children,
}: {
  config: PublicRuntimeConfig
  children: ReactNode
}) {
  return <PublicRuntimeConfigContext value={config}>{children}</PublicRuntimeConfigContext>
}
