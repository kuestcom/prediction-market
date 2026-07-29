'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { useIsMobile } from '@/hooks/useIsMobile'
import { useUser } from '@/stores/useUser'

const HowItWorks = dynamic(() => import('@/app/[locale]/(platform)/_components/HowItWorks'), { ssr: false })

function useDeferredHowItWorksTrigger({
  user,
  shouldRenderInHeader,
}: {
  user: ReturnType<typeof useUser>
  shouldRenderInHeader: boolean
}) {
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(
    function deferRenderUntilUserInteraction() {
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

      return function removeDeferredRenderListeners() {
        window.removeEventListener('scroll', renderHowItWorks)
        window.removeEventListener('pointerdown', renderHowItWorks)
        window.removeEventListener('keydown', renderHowItWorks)
      }
    },
    [shouldRenderInHeader, user],
  )

  return shouldRender
}

export default function HowItWorksDeferred() {
  const user = useUser()
  const isMobile = useIsMobile()
  const shouldRenderInHeader = !isMobile
  const shouldRender = useDeferredHowItWorksTrigger({ user, shouldRenderInHeader })

  if (user || !shouldRender || !shouldRenderInHeader) {
    return null
  }

  return <HowItWorks />
}
