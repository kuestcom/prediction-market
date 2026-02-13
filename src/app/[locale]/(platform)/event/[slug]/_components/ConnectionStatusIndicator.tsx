'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ConnectionStatusIndicatorProps {
  status: 'connecting' | 'live' | 'offline'
  className?: string
}

export default function ConnectionStatusIndicator({
  status,
  className,
}: ConnectionStatusIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={cn('relative flex size-2', className)}>
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
      <TooltipContent collisionPadding={16}>
        <span className="capitalize">{status}</span>
      </TooltipContent>
    </Tooltip>
  )
}
