'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useUser } from '@/stores/useUser'

const HowItWorks = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HowItWorks'),
  { ssr: false },
)

export default function HowItWorksDeferred() {
  const user = useUser()
  const isMobile = useIsMobile()
  const [shouldRender, setShouldRender] = useState(false)
  const shouldRenderInHeader = !isMobile

  useEffect(() => {
    if (user || !shouldRenderInHeader) {
      return
    }

    function renderHowItWorks() {
      setShouldRender(true)
    }

    const passiveOnceOptions = { once: true, passive: true } satisfies AddEventListenerOptions

    window.addEventListener('scroll', renderHowItWorks, passiveOnceOptions)
    window.addEventListener('pointerdown', renderHowItWorks, passiveOnceOptions)
    window.addEventListener('keydown', renderHowItWorks, { once: true })

    return () => {
      window.removeEventListener('scroll', renderHowItWorks)
      window.removeEventListener('pointerdown', renderHowItWorks)
      window.removeEventListener('keydown', renderHowItWorks)
    }
  }, [shouldRenderInHeader, user])

  if (user || !shouldRender || !shouldRenderInHeader) {
    return null
  }

  return <HowItWorks />
}
