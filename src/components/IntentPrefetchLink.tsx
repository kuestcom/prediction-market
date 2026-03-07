'use client'

import type { ComponentPropsWithoutRef, ComponentRef } from 'react'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'

type IntentPrefetchLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'prefetch'>
type IntentPrefetchLinkRef = ComponentRef<typeof Link>

function IntentPrefetchLink({ ref, onFocus, onMouseEnter, onTouchStart, ...props }: IntentPrefetchLinkProps & { ref?: React.RefObject<IntentPrefetchLinkRef | null> }) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false)

  function enablePrefetch() {
    setShouldPrefetch(true)
  }

  return (
    <Link
      ref={ref}
      {...props}
      prefetch={shouldPrefetch ? null : false}
      onMouseEnter={(event) => {
        enablePrefetch()
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        enablePrefetch()
        onFocus?.(event)
      }}
      onTouchStart={(event) => {
        enablePrefetch()
        onTouchStart?.(event)
      }}
    />
  )
}

export default IntentPrefetchLink
