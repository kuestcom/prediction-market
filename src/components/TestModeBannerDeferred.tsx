'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const TestModeBanner = dynamic(
  () => import('@/components/TestModeBanner'),
  { ssr: false },
)

function useShouldRenderTestModeBanner() {
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(function subscribeToFirstInteractionEvents() {
    function renderBanner() {
      setShouldRender(true)
    }

    const abortController = new AbortController()

    window.addEventListener('scroll', renderBanner, { once: true, passive: true, signal: abortController.signal })
    window.addEventListener('pointerdown', renderBanner, { once: true, passive: true, signal: abortController.signal })
    window.addEventListener('keydown', renderBanner, { once: true, signal: abortController.signal })

    return function unsubscribeFromFirstInteractionEvents() {
      abortController.abort()
    }
  }, [])

  return shouldRender
}

export default function TestModeBannerDeferred() {
  const shouldRender = useShouldRenderTestModeBanner()

  if (!shouldRender) {
    return null
  }

  return <TestModeBanner />
}
