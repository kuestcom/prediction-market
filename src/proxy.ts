import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)
const protectedPrefixes = ['/settings', '/portfolio', '/admin']
type Locale = (typeof routing.locales)[number]

function getLocaleFromPathname(pathname: string): Locale | null {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return null
}

function resolveRequestLocale(request: NextRequest, pathnameLocale: Locale | null): Locale {
  return pathnameLocale ?? routing.defaultLocale
}

function stripLocale(pathname: string, locale: Locale | null) {
  if (!locale) {
    return pathname
  }
  const withoutLocale = pathname.slice(locale.length + 1)
  return withoutLocale.startsWith('/') ? withoutLocale : '/'
}

function withLocale(pathname: string, locale: Locale | null) {
  if (!locale || locale === routing.defaultLocale) {
    return pathname
  }
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
}

export default async function proxy(request: NextRequest) {
  const url = new URL(request.url)
  const pathnameLocale = getLocaleFromPathname(url.pathname)
  const pathname = stripLocale(url.pathname, pathnameLocale)
  const locale = resolveRequestLocale(request, pathnameLocale)
  const isProtected = protectedPrefixes.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (!isProtected) {
    return intlMiddleware(request)
  }

  const hasTwoFactorCookie = Boolean(
    request.cookies.get('__Secure-better-auth.siwe_2fa_pending')
    ?? request.cookies.get('better-auth.siwe_2fa_pending'),
  )
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    if (hasTwoFactorCookie) {
      const twoFactorUrl = new URL(withLocale('/2fa', locale), request.url)
      const localizedPathname = withLocale(pathname, locale)
      twoFactorUrl.searchParams.set('next', `${localizedPathname}${url.search}`)
      return NextResponse.redirect(twoFactorUrl)
    }
    return NextResponse.redirect(new URL(withLocale('/', locale), request.url))
  }

  if (pathname.startsWith('/admin')) {
    if (!session.user?.is_admin) {
      return NextResponse.redirect(new URL(withLocale('/', locale), request.url))
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
