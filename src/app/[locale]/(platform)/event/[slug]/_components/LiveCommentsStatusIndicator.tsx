'use client'

import { useExtracted } from 'next-intl'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface LiveCommentsStatusIndicatorProps {
  status: 'connecting' | 'live' | 'offline'
  className?: string
}

export default function LiveCommentsStatusIndicator({
  status,
  className,
}: LiveCommentsStatusIndicatorProps) {
  const t = useExtracted()

  return (
    <div className={className}>
      <Tooltip>
        <TooltipTrigger>
          <span className="relative flex size-2">
            {status === 'live' && (
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-yes opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                status === 'live' && 'bg-yes',
                status === 'connecting' && 'bg-amber-500',
                status === 'offline' && 'bg-muted-foreground/40',
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent collisionPadding={8}>
          {t('Live comments status: {status}', { status })}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
