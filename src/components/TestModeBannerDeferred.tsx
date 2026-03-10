'use client'

import dynamic from 'next/dynamic'

const TestModeBanner = dynamic(
  () => import('@/components/TestModeBanner'),
  { ssr: false },
)

export default function TestModeBannerDeferred() {
  return <TestModeBanner />
}
