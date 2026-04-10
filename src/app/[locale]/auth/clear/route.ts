import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const COOKIE_NAMES = [
  'better-auth.two_factor',
  '__Secure-better-auth.two_factor',
  'kuest_l2_auth_context',
  '__Secure-kuest_l2_auth_context',
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  'better-auth.session_data',
  '__Secure-better-auth.session_data',
  'better-auth.account_data',
  '__Secure-better-auth.account_data',
  'better-auth.dont_remember',
  '__Secure-better-auth.dont_remember',
]

function expireCookie(response: NextResponse, name: string) {
  response.cookies.set({
    name,
    value: '',
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: name.startsWith('__Secure-'),
  })
}

export async function POST(_: NextRequest) {
  const response = NextResponse.json({ success: true }, { status: 200 })

  COOKIE_NAMES.forEach((name) => {
    expireCookie(response, name)
  })

  return response
}
