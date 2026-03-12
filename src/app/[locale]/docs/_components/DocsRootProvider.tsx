'use client'

import type { ReactNode } from 'react'
import { FrameworkProvider } from 'fumadocs-core/framework'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { useParams } from 'next/navigation'
import { Link, usePathname, useRouter } from '@/i18n/navigation'

interface DocsRootProviderProps {
  children: ReactNode
}

export function DocsRootProvider({ children }: DocsRootProviderProps) {
  return (
    <FrameworkProvider
      Link={Link as never}
      usePathname={usePathname as never}
      useRouter={useRouter as never}
      useParams={useParams as never}
    >
      <RootProvider
        search={{
          options: {
            api: '/docs/api/search',
          },
        }}
      >
        {children}
      </RootProvider>
    </FrameworkProvider>
  )
}
