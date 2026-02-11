'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface TeleportProps {
  to: string
  children: ReactNode
  requireReadyAttribute?: string
}

export function Teleport({ to, children, requireReadyAttribute }: TeleportProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    function resolveContainer() {
      const target = document.querySelector(to) as HTMLElement | null
      if (!target) {
        setContainer(prev => (prev === null ? prev : null))
        return
      }

      if (requireReadyAttribute && target.getAttribute(requireReadyAttribute) !== 'true') {
        setContainer(prev => (prev === null ? prev : null))
        return
      }

      setContainer(prev => (prev === target ? prev : target))
    }

    resolveContainer()

    const observer = new MutationObserver(resolveContainer)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: Boolean(requireReadyAttribute),
      attributeFilter: requireReadyAttribute ? [requireReadyAttribute] : undefined,
    })

    return () => observer.disconnect()
  }, [to, requireReadyAttribute])

  if (!container) {
    return null
  }

  return createPortal(children, container)
}
