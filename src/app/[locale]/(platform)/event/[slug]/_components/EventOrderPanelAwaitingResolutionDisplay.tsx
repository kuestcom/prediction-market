'use client'

import { useExtracted } from 'next-intl'

import { Spinner } from '@/components/ui/spinner'

interface EventOrderPanelAwaitingResolutionDisplayProps {
  marketTitle: string
}

export default function EventOrderPanelAwaitingResolutionDisplay({
  marketTitle,
}: EventOrderPanelAwaitingResolutionDisplayProps) {
  const t = useExtracted()

  return (
    <div className="flex flex-col items-center gap-4 px-2 py-6 text-center" role="status" aria-live="polite">
      <Spinner className="size-10 text-primary" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-foreground">{t('Hold on, determining winner...')}</h2>
      <div className="text-base/relaxed text-muted-foreground">{marketTitle}</div>
      <p className="max-w-sm text-sm/relaxed text-muted-foreground">
        {t('This market has ended. Final resolution will appear automatically as soon as it is available on-chain.')}
      </p>
    </div>
  )
}
