import { afterEach, describe, expect, it, vi } from 'vitest'

const confettiMock = vi.hoisted(() => ({
  fn: vi.fn(),
}))

vi.mock('canvas-confetti', () => ({
  default: confettiMock.fn,
}))

describe('utils (confetti/cn)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cn merges class names', async () => {
    const { cn } = await import('@/lib/utils')
    // eslint-disable-next-line better-tailwindcss/no-unknown-classes
    expect(cn('a', false, 'c')).toContain('a')
    // eslint-disable-next-line better-tailwindcss/no-unknown-classes
    expect(cn('a', false, 'c')).toContain('c')
  })

  it('triggerConfetti uses default origin when no event', async () => {
    const { triggerConfetti } = await import('@/lib/utils')
    confettiMock.fn.mockReset()

    triggerConfetti('yes')

    expect(confettiMock.fn).toHaveBeenCalledWith(expect.objectContaining({
      origin: { y: 0.6 },
      colors: expect.any(Array),
    }))
  })

  it('triggerConfetti computes origin from event coords', async () => {
    const { triggerConfetti } = await import('@/lib/utils')
    confettiMock.fn.mockReset()

    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 500)

    triggerConfetti('primary', { clientX: 250, clientY: 125 })

    expect(confettiMock.fn).toHaveBeenCalledWith(expect.objectContaining({
      origin: { x: 0.25, y: 0.25 },
    }))
  })
})
