import { NextResponse } from 'next/server'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'

const AFFILIATE_COOKIE_NAME = 'platform_affiliate'
const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function resolveRedirectTarget(request: Request) {
  const url = new URL(request.url)
  const toParam = url.searchParams.get('to')

  if (!toParam || !toParam.startsWith('/') || toParam.startsWith('//')) {
    return '/'
  }

  return toParam
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params
  const { data: affiliate } = await AffiliateRepository.getAffiliateByCode(code)
  const redirectTarget = resolveRedirectTarget(request)

  if (!affiliate) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const cookieValue = JSON.stringify({
    affiliateCode: affiliate.affiliate_code,
    timestamp: Date.now(),
  })

  const response = NextResponse.redirect(new URL(redirectTarget, request.url))
  response.cookies.set({
    name: AFFILIATE_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AFFILIATE_COOKIE_MAX_AGE,
  })

  return response
}
