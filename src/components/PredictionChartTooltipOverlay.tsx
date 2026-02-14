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
  valueFormatter?: (value: number) => string
  dateFormatter?: (value: Date) => string
  showSeriesLabels?: boolean
  header?: {
    iconPath?: string | null
    color?: string
  }
}

export default function PredictionChartTooltipOverlay({
  tooltipActive,
  tooltipData,
  positionedTooltipEntries,
  margin,
  innerWidth,
  clampedTooltipX,
  valueFormatter,
  dateFormatter,
  showSeriesLabels = true,
  header,
}: PredictionChartTooltipOverlayProps) {
  if (!tooltipActive || !tooltipData || positionedTooltipEntries.length === 0) {
    return null
  }

  const dateLabel = dateFormatter
    ? dateFormatter(tooltipData.date)
    : tooltipData.date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).replace(/\bAM\b/g, 'am').replace(/\bPM\b/g, 'pm')

  const pointerX = margin.left + clampedTooltipX
  const chartLeft = margin.left + 4
  const chartRight = margin.left + innerWidth - 4
  const anchorOffset = 8
  const leftSwitchThreshold = 0.14
  const rightSwitchThreshold = 0.86
  const plotWidth = Math.max(1, chartRight - chartLeft)
  const pointerRatio = (pointerX - chartLeft) / plotWidth
  const anchorPlacement: 'left' | 'center' | 'right' = Number.isFinite(pointerRatio)
    ? pointerRatio >= rightSwitchThreshold
      ? 'left'
      : pointerRatio <= leftSwitchThreshold
        ? 'right'
        : 'center'
    : 'center'
  const totalWidth = Math.max(1, margin.left + innerWidth + margin.right)
  const pointerPercent = (pointerX / totalWidth) * 100
  const anchorCenter = `${pointerPercent}%`
  const anchorRight = `calc(${pointerPercent}% + ${anchorOffset}px)`
  const anchorLeft = `calc(${pointerPercent}% - ${anchorOffset}px)`

  const dateLabelStyle = (() => {
    if (anchorPlacement === 'left') {
      return {
        left: anchorLeft,
        transform: 'translateX(-100%)',
      }
    }

    if (anchorPlacement === 'right') {
      return {
        left: anchorRight,
        transform: 'translateX(0)',
      }
    }

    return {
      left: anchorCenter,
      transform: 'translateX(-50%)',
    }
  })()

  const tooltipLabelPosition = (() => {
    if (anchorPlacement === 'left') {
      return {
        left: anchorLeft,
        transform: 'translateX(-100%)',
      }
    }

    if (anchorPlacement === 'right') {
      return {
        left: anchorRight,
        transform: 'translateX(0)',
      }
    }

    return {
      left: anchorCenter,
      transform: 'translateX(-50%)',
    }
  })()

  const formatValue = valueFormatter ?? (value => `${value.toFixed(0)}%`)
  const headerEntry = positionedTooltipEntries[0] ?? null
  const headerColor = header?.color ?? headerEntry?.color ?? 'currentColor'
  const showHeader = Boolean(header && headerEntry)
  const topLabelTop = Math.max(0, margin.top - (showHeader ? 54 : 36))

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {showHeader && headerEntry && (
        <div
          className="absolute inline-flex items-center gap-2 text-sm font-semibold tabular-nums"
          style={{
            top: topLabelTop,
            left: dateLabelStyle.left,
            transform: dateLabelStyle.transform,
            color: headerColor,
          }}
        >
          {header?.iconPath
            ? (
                <span
                  className="block size-4 shrink-0 bg-current"
                  aria-hidden
                  style={{
                    WebkitMaskImage: `url(${header.iconPath})`,
                    maskImage: `url(${header.iconPath})`,
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                  }}
                />
              )
            : (
                <span className="size-2.5 rounded-full bg-current" />
              )}
          <span>{formatValue(headerEntry.value)}</span>
        </div>
      )}

      <div
        className="absolute text-xs font-medium text-muted-foreground"
        style={{
          top: topLabelTop + (showHeader ? 20 : 0),
          left: dateLabelStyle.left,
          maxWidth: '180px',
          whiteSpace: 'nowrap',
          transform: dateLabelStyle.transform,
        }}
      >
        {dateLabel}
      </div>

      {showSeriesLabels && positionedTooltipEntries.map(entry => (
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
            {formatValue(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}
