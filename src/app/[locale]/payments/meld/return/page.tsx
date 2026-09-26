import { MeldReturnRelay } from '@/app/[locale]/payments/meld/return/MeldReturnRelay'

export default async function MeldReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ checkoutId?: string | string[] }>
}) {
  const { checkoutId } = await searchParams
  const validCheckoutId = typeof checkoutId === 'string' && /^[0-9a-f-]{36}$/iu.test(checkoutId) ? checkoutId : null

  return <MeldReturnRelay key={validCheckoutId ?? 'no-checkout'} checkoutId={validCheckoutId} />
}
