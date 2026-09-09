import type { ReactNode } from 'react'

import EventIconImage from '@/components/EventIconImage'

interface EventTradeToastProps {
  title: string
  marketImage?: string
  marketTitle?: string
  children?: ReactNode
}

export default function EventTradeToast({ title, marketImage, marketTitle, children }: EventTradeToastProps) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {marketImage && (
        <EventIconImage
          src={marketImage}
          alt={marketTitle || title}
          sizes="40px"
          containerClassName="size-10 rounded-sm shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="leading-snug font-medium break-words text-muted-foreground">{title}</div>
        {children != null && <div className="mt-1 text-xs opacity-80">{children}</div>}
      </div>
    </div>
  )
}
