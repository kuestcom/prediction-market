import TwoFactorClient from '@/app/[locale]/2fa/_components/TwoFactorClient'

export default async function TwoFactorPage({ searchParams }: PageProps<'/[locale]/2fa'>) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextValue = resolvedSearchParams?.next
  const next = Array.isArray(nextValue) ? nextValue[0] : nextValue

  return <TwoFactorClient next={next} />
}
