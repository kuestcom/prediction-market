import { Suspense } from 'react'

import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import MeldReturnStatusQuery from '@/app/[locale]/(platform)/(home)/_components/MeldReturnStatusQuery'

export const instant = false

export default async function HomePage() {
  return (
    <>
      <HomeInitialContent />
      <Suspense fallback={null}>
        <MeldReturnStatusQuery />
      </Suspense>
    </>
  )
}
