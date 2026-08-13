// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { muteEventChartContinuation } from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartCanvas'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventChartCanvas', () => {
  it('mutes only the chart continuation after the colored cursor dot', () => {
    const canvas = document.createElement('canvas')
    const snapshotCanvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 400

    const chartContext = {
      beginPath: vi.fn(),
      clip: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      rect: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      setTransform: vi.fn(),
      filter: 'none',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    }
    const snapshotContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalCompositeOperation: 'source-over',
    }

    vi.spyOn(canvas, 'getContext').mockReturnValue(chartContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(snapshotCanvas, 'getContext').mockReturnValue(snapshotContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      height: 200,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    expect(muteEventChartContinuation(canvas, snapshotCanvas, 400, '#64748B', 0.18)).toBe(true)
    expect(snapshotContext.drawImage).toHaveBeenCalledWith(canvas, 0, 0)
    expect(snapshotContext.globalCompositeOperation).toBe('source-in')
    expect(snapshotContext.fillStyle).toBe('#64748B')
    expect(snapshotContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 400)
    expect(chartContext.clearRect).toHaveBeenCalledWith(408, 0, 392, 400)
    expect(chartContext.rect).toHaveBeenCalledWith(408, 0, 392, 400)
    expect(chartContext.globalCompositeOperation).toBe('source-over')
    expect(chartContext.globalAlpha).toBe(0.18)
    expect(chartContext.drawImage).toHaveBeenCalledWith(snapshotCanvas, 0, 0)
  })
})
