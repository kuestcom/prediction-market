import { renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPORTS_EVENT_HERO_POSITIONED_LEGEND_LAYOUT } from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-constants'
import {
  useSportsGameGraphHeroLegend,
  useSportsGameGraphSeries,
} from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/useSportsGameGraph'

const WIDE_TEAM_NAME = '横浜F・マリノス'

const chartSeries = [
  { key: 'chiefs', name: 'Chiefs', color: '#f4c400' },
  { key: 'gloucester', name: WIDE_TEAM_NAME, color: '#c91f32' },
  { key: 'draw', name: 'Draw', color: '#79818d' },
]

const chartData = [
  { date: new Date('2026-04-01T00:00:00.000Z'), chiefs: 50, gloucester: 47, draw: 3 },
  { date: new Date('2026-04-26T11:30:00.000Z'), chiefs: 66, gloucester: 39, draw: 8 },
]

describe('sportsGameGraphHeroLegend', () => {
  let getContextSpy: { mockRestore: () => void }

  function measureTextWidth(text: string, font: string) {
    if (text === WIDE_TEAM_NAME) {
      return 164
    }

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

  it('reserves enough right-side room using rendered legend text widths', () => {
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

  it('does not access canvas while server rendering the fallback width', () => {
    function SportsGameGraphHeroLegendHarness() {
      const legend = useSportsGameGraphHeroLegend({
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
      })

      return <output>{legend.heroLegendRenderedWidth}</output>
    }

    const html = renderToString(<SportsGameGraphHeroLegendHarness />)

    expect(getContextSpy).not.toHaveBeenCalled()
    expect(html).toContain('<output>')
  })
})

describe('sportsGameGraphSeries', () => {
  it('scopes selected moneyline graphs to both outcomes of the selected market', () => {
    const card = {
      id: 'event-1',
      teams: [
        { name: '99DIVINE', abbreviation: '99D', color: null, logoUrl: null, record: null, hostStatus: 'home' },
        { name: 'ENTER FORCE.36', abbreviation: 'EF36', color: null, logoUrl: null, record: null, hostStatus: 'away' },
      ],
      detailMarkets: [
        {
          condition_id: 'match-winner',
          outcomes: [
            { outcome_index: 0, outcome_text: '99DIVINE', token_id: 'match-99d-token' },
            { outcome_index: 1, outcome_text: 'ENTER FORCE.36', token_id: 'match-ef36-token' },
          ],
        },
        {
          condition_id: 'game-1-winner',
          outcomes: [
            { outcome_index: 0, outcome_text: '99DIVINE', token_id: 'game1-99d-token' },
            { outcome_index: 1, outcome_text: 'ENTER FORCE.36', token_id: 'game1-ef36-token' },
          ],
        },
        {
          condition_id: 'game-2-winner',
          outcomes: [
            { outcome_index: 0, outcome_text: '99DIVINE', token_id: 'game2-99d-token' },
            { outcome_index: 1, outcome_text: 'ENTER FORCE.36', token_id: 'game2-ef36-token' },
          ],
        },
      ],
      buttons: [
        {
          key: 'match-winner:0',
          conditionId: 'match-winner',
          outcomeIndex: 0,
          label: '99D',
          color: null,
          marketType: 'moneyline',
          tone: 'team1',
        },
        {
          key: 'match-winner:1',
          conditionId: 'match-winner',
          outcomeIndex: 1,
          label: 'EF36',
          color: null,
          marketType: 'moneyline',
          tone: 'team2',
        },
        {
          key: 'game-1-winner:0',
          conditionId: 'game-1-winner',
          outcomeIndex: 0,
          label: '99D',
          color: null,
          marketType: 'moneyline',
          tone: 'team1',
        },
        {
          key: 'game-2-winner:0',
          conditionId: 'game-2-winner',
          outcomeIndex: 0,
          label: '99D',
          color: null,
          marketType: 'moneyline',
          tone: 'team1',
        },
      ],
    } as any

    const { result } = renderHook(() => useSportsGameGraphSeries({
      card,
      selectedConditionId: 'match-winner',
      isSportsEventHeroVariant: false,
    }))

    expect(result.current.chartSeries.map(series => series.name)).toEqual(['99DIVINE', 'ENTER FORCE.36'])
    expect(result.current.marketTargets).toEqual([
      { conditionId: 'match-winner:0', tokenId: 'match-99d-token' },
      { conditionId: 'match-winner:1', tokenId: 'match-ef36-token' },
    ])
  })
})
