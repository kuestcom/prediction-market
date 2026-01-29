import type { Dispatch, SetStateAction } from 'react'
import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { SeriesConfig } from '@/types/PredictionChartTypes'
import { CodeXmlIcon, FileTextIcon, ListTodoIcon, SettingsIcon, ShuffleIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const defaultChartSettings = {
  autoscale: true,
  xAxis: true,
  yAxis: true,
  horizontalGrid: true,
  verticalGrid: false,
  annotations: false,
  bothOutcomes: false,
}

export type ChartSettings = typeof defaultChartSettings
export type ChartSettingKey = keyof ChartSettings

interface EventChartControlsProps {
  timeRanges: TimeRange[]
  activeTimeRange: TimeRange
  onTimeRangeChange: (value: TimeRange) => void
  showOutcomeSwitch: boolean
  oppositeOutcomeLabel: string
  onShuffle: () => void
  showMarketSelector?: boolean
  marketOptions?: SeriesConfig[]
  selectedMarketIds?: string[]
  maxSeriesCount?: number
  onToggleMarket?: (marketId: string) => void
  settings: ChartSettings
  onSettingsChange: Dispatch<SetStateAction<ChartSettings>>
  onExportData?: () => void
  onEmbed?: () => void
}

export default function EventChartControls({
  timeRanges,
  activeTimeRange,
  onTimeRangeChange,
  showOutcomeSwitch,
  oppositeOutcomeLabel,
  onShuffle,
  showMarketSelector = false,
  marketOptions = [],
  selectedMarketIds = [],
  maxSeriesCount = 0,
  onToggleMarket,
  settings,
  onSettingsChange,
  onExportData,
  onEmbed,
}: EventChartControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const selectedSet = new Set(selectedMarketIds)
  const selectedOptions = marketOptions.filter(option => selectedSet.has(option.key))
  const unselectedOptions = marketOptions.filter(option => !selectedSet.has(option.key))
  const maxReached = maxSeriesCount > 0 && selectedMarketIds.length >= maxSeriesCount
  const hasMarketSelector = showMarketSelector && marketOptions.length > 0
  const baseSettingItems: Array<{ key: ChartSettingKey, label: string }> = [
    { key: 'autoscale', label: 'Autoscale' },
    { key: 'xAxis', label: 'X-Axis' },
    { key: 'yAxis', label: 'Y-Axis' },
    { key: 'horizontalGrid', label: 'Horizontal Grid' },
    { key: 'verticalGrid', label: 'Vertical Grid' },
    { key: 'annotations', label: 'Annotations' },
    { key: 'bothOutcomes', label: 'Both Outcomes' },
  ]
  const settingItems = showOutcomeSwitch
    ? baseSettingItems
    : baseSettingItems.filter(item => item.key !== 'bothOutcomes')

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <div
        className="flex flex-wrap items-center justify-start gap-1 text-xs font-semibold"
      >
        {timeRanges.map(range => (
          <button
            key={range}
            type="button"
            className={cn(
              'relative px-2 py-1 transition-colors',
              activeTimeRange === range
                ? 'text-foreground'
                : 'text-muted-foreground',
            )}
            data-range={range}
            onClick={() => onTimeRangeChange(range)}
            aria-pressed={activeTimeRange === range}
          >
            {range}
          </button>
        ))}
      </div>

      {hasMarketSelector && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={
                `
                  flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground
                  transition-colors
                  hover:text-foreground
                `
              }
              aria-label="Show outcomes on chart"
            >
              <ListTodoIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            className="w-64 border border-border bg-background p-3 text-foreground shadow-xl"
          >
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-foreground">Show on chart</span>
              <span className="text-sm text-muted-foreground">
                Select a maximum of
                {' '}
                {maxSeriesCount}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {selectedOptions.map(option => (
                <DropdownMenuItem
                  key={option.key}
                  onSelect={(event) => {
                    event.preventDefault()
                    if (selectedMarketIds.length <= 1) {
                      toast.info(
                        <span className="text-base font-semibold text-muted-foreground">At least one option required</span>,
                        {
                          description: (
                            <span className="text-base text-muted-foreground">
                              You cannot remove all options from the chart. Please keep at least one option selected.
                            </span>
                          ),
                        },
                      )
                      return
                    }
                    onToggleMarket?.(option.key)
                  }}
                  className={cn(
                    `
                      flex items-center justify-between gap-3 rounded-md bg-muted/70 px-3 py-2 text-sm font-semibold
                      text-foreground
                    `,
                    'hover:bg-muted/80 focus:bg-muted focus:text-foreground',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex size-4 items-center justify-center text-muted-foreground">
                          <XIcon className="size-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Remove
                      </TooltipContent>
                    </Tooltip>
                    <span className="truncate text-foreground">{option.name}</span>
                  </span>
                  <span
                    className="size-3.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: option.color }}
                  />
                </DropdownMenuItem>
              ))}

              {unselectedOptions.map((option) => {
                const isDisabled = maxReached
                return (
                  <DropdownMenuItem
                    key={option.key}
                    onSelect={(event) => {
                      event.preventDefault()
                      if (isDisabled) {
                        return
                      }
                      onToggleMarket?.(option.key)
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold',
                      isDisabled
                        ? 'cursor-not-allowed text-muted-foreground'
                        : 'text-foreground hover:bg-muted/70 focus:bg-muted',
                    )}
                    aria-disabled={isDisabled}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex size-4 items-center justify-center" />
                      <span className="truncate">{option.name}</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {showOutcomeSwitch && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={
                `
                  flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground
                  transition-colors
                  hover:text-foreground
                `
              }
              onClick={onShuffle}
              aria-label={`Switch to ${oppositeOutcomeLabel}`}
            >
              <ShuffleIcon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Switch to
            {' '}
            {oppositeOutcomeLabel}
          </TooltipContent>
        </Tooltip>
      )}

      <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`
              flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground
              transition-colors
              hover:text-foreground
            `}
            aria-label="Chart settings"
          >
            <SettingsIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="w-52 border border-border bg-background p-3 text-sm font-semibold text-foreground shadow-xl"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80"
                onClick={() => {
                  onEmbed?.()
                  setSettingsOpen(false)
                }}
              >
                <CodeXmlIcon className="size-4" />
                <span>Embed</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80"
                onClick={() => {
                  onExportData?.()
                  setSettingsOpen(false)
                }}
              >
                <FileTextIcon className="size-4" />
                <span>Export Data</span>
              </button>
            </div>
            <DropdownMenuSeparator className="my-0" />
            <div className="flex flex-col gap-2">
              {settingItems.map((item) => {
                const settingId = `chart-setting-${item.key}`
                return (
                  <label
                    key={item.key}
                    htmlFor={settingId}
                    className={`
                      flex items-center justify-between gap-4 text-foreground transition-colors
                      hover:text-foreground/80
                    `}
                  >
                    <span>{item.label}</span>
                    <Switch
                      id={settingId}
                      checked={settings[item.key]}
                      onCheckedChange={value => onSettingsChange(prev => ({ ...prev, [item.key]: value }))}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
