'use client'

import type { Route } from 'next'
import type { ComponentProps } from 'react'

import { useCallback } from 'react'

import { Link, useRouter } from '@/i18n/navigation'

type NavigationLinkProps = ComponentProps<typeof Link>

interface PrefetchLinkProps extends Omit<NavigationLinkProps, 'href'> {
  href: string
}

export default function PrefetchLink({
  href,
  onFocus,
  onPointerDown,
  onPointerEnter,
  prefetch = true,
  ...props
}: PrefetchLinkProps) {
  const router = useRouter()
  const prefetchRoute = useCallback(() => {
    if (prefetch === false || !href.startsWith('/')) {
      return
    }

    router.prefetch(href as Route)
  }, [href, prefetch, router])

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onFocus={(event) => {
        prefetchRoute()
        onFocus?.(event)
      }}
      onPointerDown={(event) => {
        prefetchRoute()
        onPointerDown?.(event)
      }}
      onPointerEnter={(event) => {
        prefetchRoute()
        onPointerEnter?.(event)
      }}
    />
  )
}
