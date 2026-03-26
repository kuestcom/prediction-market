'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { shouldHideMobileBottomNav } from '@/app/[locale]/(platform)/_lib/mobile-bottom-nav'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePathname } from '@/i18n/navigation'
import { useUser } from '@/stores/useUser'

const HowItWorks = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HowItWorks'),
  { ssr: false },
)

export default function HowItWorksDeferred() {
  const user = useUser()
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const [shouldRender, setShouldRender] = useState(false)
  const shouldRenderInHeader = !isMobile || shouldHideMobileBottomNav(pathname)

  useEffect(() => {
    if (user) {
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
  }, [user])

  if (user || !shouldRender || !shouldRenderInHeader) {
    return null
  }

  return <HowItWorks />
}
