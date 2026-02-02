import type { DataPoint } from '@/types/PredictionChartTypes'
import { TOOLTIP_LABEL_MAX_WIDTH } from '@/lib/prediction-chart'

interface TooltipEntry {
  key: string
  name: string
  color: string
  value: number
  top: number
}

interface PredictionChartTooltipOverlayProps {
  tooltipActive: boolean
  tooltipData: DataPoint | null
  positionedTooltipEntries: TooltipEntry[]
  margin: { top: number, right: number, bottom: number, left: number }
  innerWidth: number
  clampedTooltipX: number
}

export default function PredictionChartTooltipOverlay({
  tooltipActive,
  tooltipData,
  positionedTooltipEntries,
  margin,
  innerWidth,
  clampedTooltipX,
}: PredictionChartTooltipOverlayProps) {
  if (!tooltipActive || !tooltipData || positionedTooltipEntries.length === 0) {
    return null
  }

  const rawDateLabel = tooltipData.date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const dateLabel = rawDateLabel
    .replace(/\bAM\b/g, 'am')
    .replace(/\bPM\b/g, 'pm')

  const pointerX = margin.left + clampedTooltipX
  const chartLeft = margin.left + 4
  const chartRight = margin.left + innerWidth - 4
  const anchorOffset = 8
  const switchThreshold = 0.86
  const plotWidth = Math.max(1, chartRight - chartLeft)
  const pointerRatio = (pointerX - chartLeft) / plotWidth
  const placeRightByRatio = Number.isFinite(pointerRatio)
    ? pointerRatio <= switchThreshold
    : true
  const totalWidth = Math.max(1, margin.left + innerWidth + margin.right)
  const pointerPercent = (pointerX / totalWidth) * 100
  const anchorRight = `calc(${pointerPercent}% + ${anchorOffset}px)`
  const anchorLeft = `calc(${pointerPercent}% - ${anchorOffset}px)`

  const dateLabelStyle = (() => {
    const placeRight = placeRightByRatio

    return {
      left: placeRight ? anchorRight : anchorLeft,
      transform: placeRight ? 'translateX(0)' : 'translateX(-100%)',
    }
  })()

  const tooltipLabelPosition = (() => {
    const placeRight = placeRightByRatio

    return {
      left: placeRight ? anchorRight : anchorLeft,
      transform: placeRight ? 'translateX(0)' : 'translateX(-100%)',
    }
  })()

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute text-xs font-medium text-muted-foreground"
        style={{
          top: Math.max(0, margin.top - 36),
          left: dateLabelStyle.left,
          maxWidth: '180px',
          whiteSpace: 'nowrap',
          transform: dateLabelStyle.transform,
        }}
      >
        {dateLabel}
      </div>

      {positionedTooltipEntries.map(entry => (
        <div
          key={`${entry.key}-label`}
          className={
            `
              absolute inline-flex h-5 w-fit items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]/5 font-semibold
              text-white
            `
          }
          style={{
            top: entry.top,
            left: tooltipLabelPosition.left,
            maxWidth: `${TOOLTIP_LABEL_MAX_WIDTH}px`,
            transform: tooltipLabelPosition.transform,
            backgroundColor: entry.color,
          }}
        >
          <span className="max-w-30 truncate capitalize">
            {entry.name}
          </span>
          <span className="tabular-nums">
            {entry.value.toFixed(0)}
            %
          </span>
        </div>
      ))}
    </div>
  )
}
