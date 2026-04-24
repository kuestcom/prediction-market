import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT } from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-constants'
import { useSportsGameGraphHeroLegend } from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/useSportsGameGraph'

const chartSeries = [
  { key: 'chiefs', name: 'Chiefs', color: '#f4c400' },
  { key: 'gloucester', name: 'Gloucester', color: '#c91f32' },
  { key: 'draw', name: 'Draw', color: '#79818d' },
]

const chartData = [
  { date: new Date('2026-04-01T00:00:00.000Z'), chiefs: 50, gloucester: 47, draw: 3 },
  { date: new Date('2026-04-26T11:30:00.000Z'), chiefs: 66, gloucester: 39, draw: 8 },
]

describe('sportsGameGraphHeroLegend', () => {
  let getContextSpy: { mockRestore: () => void }

  function measureTextWidth(text: string, font: string) {
    const fontSizeMatch = font.match(/(\d+)px/)
    const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : 16
    const widthMultiplier = text.endsWith('%') ? 0.58 : 0.56

    return Math.ceil(text.length * fontSize * widthMultiplier)
  }

  beforeEach(() => {
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
      let currentFont = ''

      return {
        get font() {
          return currentFont
        },
        set font(value: string) {
          currentFont = value
        },
        measureText: (text: string) => ({
          width: measureTextWidth(text, currentFont),
        }),
      }
    }) as any)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
  })

  it('reserves enough right-side room for large hero percent labels', () => {
    const { result } = renderHook(() => useSportsGameGraphHeroLegend({
      canRenderPositionedSeriesLegend: true,
      chartSeries,
      chartData,
      chartWidth: 860,
      chartHeight: 332,
      chartMargin: { top: 12, right: 46, bottom: 40, left: 0 },
      cursorSnapshot: null,
      latestSnapshot: { chiefs: 66, gloucester: 39, draw: 8 },
      positionedLegendLayout: SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT,
      usesPositionedSeriesLegend: true,
    }))

    const entry = result.current.heroLegendPositionedEntries[0]
    const expectedWidth = Math.max(
      SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT.minWidthPx,
      Math.ceil(
        Math.max(
          ...chartSeries.map(seriesItem => measureTextWidth(
            seriesItem.name,
            SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT.nameFont,
          )),
          measureTextWidth('100%', SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT.valueFont),
        ) + SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT.horizontalPaddingPx,
      ),
    )

    expect(result.current.heroLegendRenderedWidth).toBe(expectedWidth)
    expect(entry?.left).toBeGreaterThan(0)
    expect(entry?.width).toBe(result.current.heroLegendRenderedWidth)
    expect((entry?.left ?? 0) + (entry?.width ?? 0)).toBeLessThanOrEqual(
      860 - 46 - SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT.rightInsetPx,
    )
  })
})
