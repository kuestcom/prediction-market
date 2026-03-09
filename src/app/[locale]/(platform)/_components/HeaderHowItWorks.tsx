'use client'

import dynamic from 'next/dynamic'

const HowItWorks = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HowItWorks'),
  { ssr: false },
)

export default function HeaderHowItWorks() {
  return <HowItWorks />
}
