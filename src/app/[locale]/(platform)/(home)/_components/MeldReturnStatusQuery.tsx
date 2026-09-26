'use client'

import { useSearchParams } from 'next/navigation'

import { MeldReturnStatus } from '@/app/[locale]/payments/meld/return/MeldReturnStatus'

export default function MeldReturnStatusQuery() {
  const checkoutId = useSearchParams().get('meldCheckoutId')

  return checkoutId ? <MeldReturnStatus checkoutId={checkoutId} /> : null
}
