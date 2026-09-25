import { NextResponse } from 'next/server'

import { UserRepository } from '@/lib/db/queries/user'
import { getPaymentsCanonicalDomain, getPaymentsOperatorKey } from '@/lib/payments/operator-key'

export async function GET(request: Request) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const operatorKey = await getPaymentsOperatorKey(getPaymentsCanonicalDomain(request.headers))
  return NextResponse.json({ enabled: Boolean(operatorKey) }, { headers: { 'Cache-Control': 'no-store' } })
}
