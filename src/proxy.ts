import type { NextRequest } from 'next/server'
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation'
import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)
const protectedPrefixes = ['/settings', '/portfolio', '/admin']
type Locale = (typeof routing.locales)[number]
const { rewrite: rewriteMarkdownExtensionWithLocale } = rewritePath(
  '/:locale/docs{/*path}.mdx',
  '/:locale/llms.mdx/docs{/*path}',
)
const { rewrite: rewriteMarkdownExtensionDefaultLocale } = rewritePath(
  '/docs{/*path}.mdx',
  '/en/llms.mdx/docs{/*path}',
)
const { rewrite: rewriteMarkdownWithLocale } = rewritePath(
  '/:locale/docs{/*path}',
  '/:locale/llms.mdx/docs{/*path}',
)
const { rewrite: rewriteMarkdownDefaultLocale } = rewritePath(
  '/docs{/*path}',
  '/en/llms.mdx/docs{/*path}',
)

function getLocaleFromPathname(pathname: string): Locale | null {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return null
}

function resolveRequestLocale(pathnameLocale: Locale | null): Locale {
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
  const markdownPath = rewriteMarkdownExtensionWithLocale(url.pathname) || rewriteMarkdownExtensionDefaultLocale(url.pathname)

  if (markdownPath) {
    const rewrittenUrl = new URL(markdownPath, request.url)
    rewrittenUrl.search = url.search
    return NextResponse.rewrite(rewrittenUrl)
  }

  if (isMarkdownPreferred(request)) {
    const rewrittenPath = rewriteMarkdownWithLocale(url.pathname) || rewriteMarkdownDefaultLocale(url.pathname)
    if (rewrittenPath) {
      const rewrittenUrl = new URL(rewrittenPath, request.url)
      rewrittenUrl.search = url.search
      return NextResponse.rewrite(rewrittenUrl)
    }
  }

  const pathnameLocale = getLocaleFromPathname(url.pathname)
  const pathname = stripLocale(url.pathname, pathnameLocale)
  const locale = resolveRequestLocale(pathnameLocale)
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
  matcher: [
    '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
    '/docs.mdx',
    '/docs/:path*.mdx',
    '/:locale/docs.mdx',
    '/:locale/docs/:path*.mdx',
  ],
}
