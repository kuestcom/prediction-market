'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

interface EventDeferredSectionProps {
  children: ReactNode
  fallback?: ReactNode
  rootMargin?: string
  minHeightClassName?: string
}

export default function EventDeferredSection({
  children,
  fallback = null,
  rootMargin = '320px 0px',
  minHeightClassName,
}: EventDeferredSectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible) {
      return
    }

    const node = containerRef.current
    if (!node) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) {
        return
      }

      setIsVisible(true)
      observer.disconnect()
    }, { rootMargin })

    observer.observe(node)

    return () => observer.disconnect()
  }, [isVisible, rootMargin])

  return (
    <div ref={containerRef} className={minHeightClassName}>
      {isVisible ? children : fallback}
    </div>
  )
}
