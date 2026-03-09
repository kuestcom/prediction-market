import { describe, expect, it } from 'vitest'
import { oklchToRenderableColor } from '@/lib/color'

describe('oklchToRenderableColor', () => {
  it('supports equivalent hue angle units', () => {
    const degrees = oklchToRenderableColor('oklch(0.72 0.18 90deg)')

    expect(oklchToRenderableColor('oklch(0.72 0.18 100grad)')).toBe(degrees)
    expect(oklchToRenderableColor('oklch(0.72 0.18 1.5707963267948966rad)')).toBe(degrees)
    expect(oklchToRenderableColor('oklch(0.72 0.18 0.25turn)')).toBe(degrees)
  })

  it('rejects unsupported hue units', () => {
    expect(oklchToRenderableColor('oklch(0.72 0.18 90foo)')).toBeNull()
  })
})
