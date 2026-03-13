'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const HowItWorks = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HowItWorks'),
  { ssr: false },
)

export default function HowItWorksDeferred() {
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
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
  }, [])

  if (!shouldRender) {
    return null
  }

  return <HowItWorks />
}
