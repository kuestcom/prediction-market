'use client'

import { useExtracted } from 'next-intl'
import { useMarketChannelStatus } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface MarketChannelStatusIndicatorProps {
  className?: string
}

export default function MarketChannelStatusIndicator({ className }: MarketChannelStatusIndicatorProps) {
  const t = useExtracted()
  const wsStatus = useMarketChannelStatus()

  return (
    <div className={className}>
      <Tooltip>
        <TooltipTrigger>
          <span className="relative flex size-2">
            {wsStatus === 'live' && (
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-yes opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                wsStatus === 'live' && 'bg-yes',
                wsStatus === 'connecting' && 'bg-amber-500',
                wsStatus === 'offline' && 'bg-muted-foreground/40',
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent collisionPadding={8}>
          {t('Live data status: {status}', { status: wsStatus })}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
