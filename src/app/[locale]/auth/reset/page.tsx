'use client'

import { ThemeProvider } from 'next-themes'
import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import HeaderLogo from '@/components/HeaderLogo'
import { authClient } from '@/lib/auth-client'
import { clearBrowserStorage, clearNonHttpOnlyCookies } from '@/lib/utils'

export default function AuthResetPage() {
  const params = useParams()
  const rawLocale = params?.locale
  const locale = Array.isArray(rawLocale) ? rawLocale[0] : rawLocale
  const redirectHref = !locale || locale === 'en' ? '/' : `/${locale}`

  useEffect(() => {
    let isActive = true

    async function clearAuthState() {
      try {
        await authClient.signOut()
      }
      catch {
        //
      }

      try {
        await fetch('/auth/clear', { credentials: 'include' })
      }
      catch {
        //
      }

      clearBrowserStorage()
      clearNonHttpOnlyCookies()

      if (isActive) {
        window.location.href = redirectHref
      }
    }

    void clearAuthState()

    return () => {
      isActive = false
    }
  }, [redirectHref])

  return (
    <ThemeProvider attribute="class">
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <HeaderLogo />
      </main>
    </ThemeProvider>
  )
}
