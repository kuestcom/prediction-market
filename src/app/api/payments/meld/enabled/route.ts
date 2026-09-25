import { NextResponse } from 'next/server'

import { UserRepository } from '@/lib/db/queries/user'
import { getPaymentsOperatorKey } from '@/lib/payments/operator-key'

export async function GET() {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const operatorKey = await getPaymentsOperatorKey()
  return NextResponse.json({ enabled: Boolean(operatorKey) }, { headers: { 'Cache-Control': 'no-store' } })
}
