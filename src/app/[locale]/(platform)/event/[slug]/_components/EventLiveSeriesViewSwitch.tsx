'use client'

import { ChartLineIcon } from 'lucide-react'

import type { EventLiveChartConfig } from '@/types'

import { cn } from '@/lib/utils'

import { hexToRgba } from '../_utils/eventLiveSeriesChartUtils'

interface EventLiveSeriesViewSwitchProps {
  activeView: 'live' | 'market'
  setActiveView: (view: 'live' | 'market') => void
  liveColor: string
  config: EventLiveChartConfig
}

export default function EventLiveSeriesViewSwitch({
  activeView,
  setActiveView,
  liveColor,
  config,
}: EventLiveSeriesViewSwitchProps) {
  const isLiveChartView = activeView === 'live'
  const isMarketView = activeView === 'market'

  const liveSwitchIconStyle = isLiveChartView
    ? {
        color: liveColor,
      }
    : undefined

  const switchThumbStyle = isLiveChartView
    ? {
        transform: 'translateX(2rem)',
        backgroundColor: hexToRgba(liveColor, 0.2),
      }
    : {
        transform: 'translateX(0)',
      }

  return (
    <div className="relative z-0 flex items-center rounded-lg border border-border bg-background/70 p-0.5">
      <span
        className={cn(
          'pointer-events-none absolute top-0.5 left-0.5 z-0 size-8 rounded-md transition-all duration-300 ease-out',
          !isLiveChartView && 'bg-primary/30',
        )}
        style={switchThumbStyle}
      />
      <button
        type="button"
        onClick={() => setActiveView('market')}
        className={cn(
          'relative z-1 flex size-8 items-center justify-center rounded-md transition-colors',
          isMarketView ? 'text-primary' : 'bg-transparent text-muted-foreground hover:bg-muted',
        )}
        aria-label="Show market chart"
      >
        <ChartLineIcon className="size-[18px]" />
      </button>
      <button
        type="button"
        onClick={() => setActiveView('live')}
        className={cn(
          'relative z-1 flex size-8 items-center justify-center rounded-md transition-colors',
          !isLiveChartView && 'bg-transparent text-muted-foreground hover:bg-muted',
        )}
        style={liveSwitchIconStyle}
        aria-label="Show live chart"
      >
        {config.icon_path ? (
          <span
            className="block size-4 bg-current"
            aria-hidden
            style={{
              WebkitMaskImage: `url(${config.icon_path})`,
              maskImage: `url(${config.icon_path})`,
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
        ) : (
          <span className="size-2 rounded-full bg-current" />
        )}
      </button>
    </div>
  )
}
