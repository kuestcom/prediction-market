import { MeldReturnStatus } from './MeldReturnStatus'

export default async function MeldReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ checkoutId?: string | string[] }>
}) {
  const { checkoutId } = await searchParams
  return <MeldReturnStatus checkoutId={typeof checkoutId === 'string' ? checkoutId : null} />
}
