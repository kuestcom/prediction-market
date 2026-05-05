'use client'

import { useEffect } from 'react'

function useAffiliateQueryRedirect() {
  useEffect(function redirectAffiliateQuery() {
    const url = new URL(window.location.href)
    const affiliateCode = url.searchParams.get('r')?.trim()

    if (!affiliateCode || url.pathname.startsWith('/r/')) {
      return
    }

    url.searchParams.delete('r')
    const targetPath = `${url.pathname}${url.search}` || '/'
    const redirectUrl = `/r/${encodeURIComponent(affiliateCode)}?to=${encodeURIComponent(targetPath)}`

    window.location.replace(redirectUrl)
  }, [])
}

export default function AffiliateQueryHandler() {
  useAffiliateQueryRedirect()

  return null
}
