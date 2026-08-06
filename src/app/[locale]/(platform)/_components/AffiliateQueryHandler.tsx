'use client'

import { useEffect } from 'react'

import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'

export function resolveAffiliateQueryRedirect(href: string, siteUrl: string) {
  const url = new URL(href)
  const affiliateReference = url.searchParams.get('r')?.trim()

  if (!affiliateReference || url.pathname.startsWith('/r/')) {
    return null
  }

  url.searchParams.delete('r')
  const targetPath = `${url.pathname}${url.search}` || '/'
  const redirectPath = `/r/${encodeURIComponent(affiliateReference)}?to=${encodeURIComponent(targetPath)}`

  const isLocalRuntimeHost = url.hostname === '0.0.0.0' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (isLocalRuntimeHost) {
    try {
      return new URL(redirectPath, siteUrl).toString()
    } catch {
      // Keep local development usable when runtime configuration is incomplete.
    }
  }
  return new URL(redirectPath, url.origin).toString()
}

function useAffiliateQueryRedirect() {
  const { siteUrl } = usePublicRuntimeConfig()

  useEffect(
    function redirectAffiliateQuery() {
      const redirectUrl = resolveAffiliateQueryRedirect(window.location.href, siteUrl)
      if (!redirectUrl) {
        return
      }
      window.location.replace(redirectUrl)
    },
    [siteUrl],
  )
}

export default function AffiliateQueryHandler() {
  useAffiliateQueryRedirect()

  return null
}
