'use client'

import type { PointerEvent } from 'react'

import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'

import { formatCurrency } from '@/lib/formatters'
import { calculateFeeBreakdown } from '@/lib/trading-fees'
import { cn } from '@/lib/utils'

const CHART_WIDTH = 640
const CHART_HEIGHT = 292
const PLOT = { top: 22, right: 16, bottom: 36, left: 48 }
const SHARE_COUNT = 100

interface FeeCategory {
  id: string
  label: string
  rate: number
  color: string
}

interface AdminAffiliateFeeChartProps {
  operatorSharePercent: number
  siteName: string
  audience?: 'admin' | 'trader'
}

function feeBreakdown(price: number, rate: number, operatorSharePercent: number) {
  const fee = calculateFeeBreakdown({
    shares: SHARE_COUNT,
    price,
    notional: SHARE_COUNT * price,
    schedule: { rate, exponent: 1, takerOnly: true, rebateRate: 0 },
    operatorShareBps: Math.round(operatorSharePercent * 100),
  })
  return { kuest: fee.kuestFee, operator: fee.operatorFee, total: fee.totalFee }
}

function formatFeeAmount(value: number) {
  return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 3 })
}

export default function AdminAffiliateFeeChart({
  operatorSharePercent,
  siteName,
  audience = 'admin',
}: AdminAffiliateFeeChartProps) {
  const t = useExtracted()
  const categories = useMemo<FeeCategory[]>(
    () => [
      { id: 'crypto', label: t('Crypto'), rate: 0.0441, color: '#0ea5e9' },
      {
        id: 'general',
        label: t('Sports / Economics / Culture / Weather / General'),
        rate: 0.0315,
        color: '#a855f7',
      },
      {
        id: 'finance',
        label: t('Finance / Politics / Mentions / Tech / Geopolitics'),
        rate: 0.0252,
        color: '#f97316',
      },
    ],
    [t],
  )
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null)
  const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom
  const points = useMemo(() => Array.from({ length: 99 }, (_, index) => (index + 1) / 100), [])
  const maxTotal = Math.max(
    0.25,
    ...categories.flatMap((category) => points.map((price) => feeBreakdown(price, category.rate, 45).total)),
  )
  const yMax = Math.ceil(maxTotal * 1.15 * 4) / 4
  function xScale(price: number) {
    return PLOT.left + price * plotWidth
  }

  function yScale(value: number) {
    return PLOT.top + plotHeight - (value / yMax) * plotHeight
  }

  function linePath(category: FeeCategory) {
    return points
      .map((price, index) => {
        const total = feeBreakdown(price, category.rate, operatorSharePercent).total
        return `${index === 0 ? 'M' : 'L'} ${xScale(price).toFixed(2)} ${yScale(total).toFixed(2)}`
      })
      .join(' ')
  }
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0]
  const activePrice = hoveredPrice ?? 0.5
  const activeFeeBreakdown = feeBreakdown(activePrice, activeCategory.rate, operatorSharePercent)
  const activeKuestFee = activeFeeBreakdown.kuest
  const activeOperatorFee = activeFeeBreakdown.operator
  const activeTotal = activeFeeBreakdown.total
  const showTooltip = activeCategoryId !== null

  function activateCategory(categoryId: string, price = 0.5) {
    setActiveCategoryId(categoryId)
    setHoveredPrice(price)
  }

  function handleChartPointerMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * CHART_HEIGHT
    const rawPrice = Math.min(0.99, Math.max(0.01, (pointerX - PLOT.left) / plotWidth))
    const price = Math.round(rawPrice * 100) / 100
    const nearestCategory = categories.reduce(
      (nearest, category) => {
        const total = feeBreakdown(price, category.rate, operatorSharePercent).total
        const distance = Math.abs(yScale(total) - pointerY)
        return distance < nearest.distance ? { category, distance } : nearest
      },
      { category: categories[0], distance: Number.POSITIVE_INFINITY },
    )

    activateCategory(nearestCategory.category.id, price)
  }

  function clearInteraction() {
    setActiveCategoryId(null)
    setHoveredPrice(null)
  }

  return (
    <div className={cn('grid gap-4 rounded-lg border p-5', audience === 'admin' ? 'h-full' : 'not-prose')}>
      <div>
        <h2 className="text-xl font-semibold">{t('Taker fee for 100 shares')}</h2>
        <p className="text-sm text-muted-foreground">
          {audience === 'admin'
            ? t('Operator share follows the market fee curve.')
            : t('Estimated taker fee at each execution price.')}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {categories.map((category) => {
          const active = activeCategoryId === category.id
          return (
            <button
              type="button"
              key={category.id}
              className={cn(
                'inline-flex items-center gap-1.5 text-left text-xs text-muted-foreground transition-opacity',
                active && 'font-semibold text-foreground',
                activeCategoryId && !active && 'opacity-35',
              )}
              onPointerEnter={() => activateCategory(category.id)}
              onPointerLeave={clearInteraction}
              onFocus={() => activateCategory(category.id)}
              onBlur={clearInteraction}
            >
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: category.color }} />
              {category.label}
            </button>
          )
        })}
      </div>

      <div className={cn('relative', audience === 'admin' ? 'min-h-64' : 'aspect-[640/292] w-full')}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className={cn(
            'w-full touch-none overflow-visible',
            audience === 'admin' ? 'h-auto' : 'absolute inset-0 h-full',
          )}
          role="img"
          aria-label={t('Taker fee by share price')}
          onPointerMove={handleChartPointerMove}
          onPointerLeave={clearInteraction}
        >
          {Array.from({ length: 5 }, (_, index) => {
            const value = (yMax * index) / 4
            const y = yScale(value)
            return (
              <g key={value}>
                <line x1={PLOT.left} x2={CHART_WIDTH - PLOT.right} y1={y} y2={y} className="stroke-border" />
                <text x={PLOT.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
                  {formatCurrency(value)}
                </text>
              </g>
            )
          })}

          {[0.1, 0.3, 0.5, 0.7, 0.9].map((price) => (
            <text
              key={price}
              x={xScale(price)}
              y={CHART_HEIGHT - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {Math.round(price * 100)}¢
            </text>
          ))}

          {categories.map((category) => {
            const active = activeCategoryId === category.id
            return (
              <path
                key={category.id}
                d={linePath(category)}
                fill="none"
                stroke={category.color}
                strokeWidth={active ? 3 : 2}
                opacity={activeCategoryId && !active ? 0.18 : 1}
                className="transition-opacity"
              />
            )
          })}

          {showTooltip && (
            <>
              <line
                x1={xScale(activePrice)}
                x2={xScale(activePrice)}
                y1={PLOT.top}
                y2={PLOT.top + plotHeight}
                className="stroke-muted-foreground/35"
                strokeDasharray="3 3"
              />
              <circle
                cx={xScale(activePrice)}
                cy={yScale(activeTotal)}
                r="5"
                className="fill-card"
                stroke={activeCategory.color}
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>

        {showTooltip && (
          <div
            className="pointer-events-none absolute z-10 w-44 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md"
            style={{
              left: `${(xScale(activePrice) / CHART_WIDTH) * 100}%`,
              top: `${Math.min(82, Math.max(18, (yScale(activeTotal) / CHART_HEIGHT) * 100))}%`,
              transform: activePrice > 0.65 ? 'translate(calc(-100% - 12px), -50%)' : 'translate(12px, -50%)',
            }}
          >
            <div className="mb-1.5 line-clamp-2 leading-4 font-semibold" style={{ color: activeCategory.color }}>
              {activeCategory.label}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span className="text-muted-foreground">{t('Share price')}</span>
              <span className="font-medium">{Math.round(activePrice * 100)}¢</span>
              {audience === 'admin' && (
                <>
                  <span className="text-muted-foreground">{t('Kuest fee')}</span>
                  <span className="font-medium">{formatFeeAmount(activeKuestFee)}</span>
                  <span className="text-muted-foreground">{t('{siteName} fee', { siteName })}</span>
                  <span className="font-medium">{formatFeeAmount(activeOperatorFee)}</span>
                </>
              )}
              <span className="font-semibold">{audience === 'admin' ? t('Total') : t('Trading fee')}</span>
              <span className="font-semibold">{formatFeeAmount(activeTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
