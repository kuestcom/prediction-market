'use client'

import { Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'

interface EventOrderPanelAwaitingResolutionDisplayProps {
  marketTitle: string
}

export default function EventOrderPanelAwaitingResolutionDisplay({
  marketTitle,
}: EventOrderPanelAwaitingResolutionDisplayProps) {
  const t = useExtracted()

  return (
    <div
      className="flex flex-col items-center gap-5 px-3 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2Icon className="size-10 animate-spin text-primary" aria-hidden="true" />
      <h2 className="text-xl font-semibold text-foreground">
        {t('Hold on, determining winner...')}
      </h2>
      <div className="text-base/snug text-muted-foreground">
        {marketTitle}
      </div>
      <p className="max-w-sm text-sm/relaxed text-muted-foreground">
        {t('This market has ended. Final resolution will appear automatically as soon as it is available on-chain.')}
      </p>
    </div>
  )
}
