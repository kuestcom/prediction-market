import { act, render, screen } from '@testing-library/react'
import EventBackToTopButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventBackToTopButton'

const mocks = vi.hoisted(() => ({
  pathname: '/event/first-event',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

let animationFrameId = 0
let animationFrameCallbacks = new Map<number, FrameRequestCallback>()

function setWindowViewport({ scrollY, width }: { scrollY: number, width: number }) {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: scrollY,
  })

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

function createDomRect({
  left = 0,
  top = 0,
  width = 0,
  height = 0,
}: Partial<DOMRect> = {}) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON() {
      return {}
    },
  } as DOMRect
}

function createEventPageAnchors() {
  const content = document.createElement('div')
  content.id = 'event-content-main'
  content.getBoundingClientRect = () => createDomRect({ left: 24, width: 960 })

  const eventMarkets = document.createElement('div')
  eventMarkets.id = 'event-markets'
  eventMarkets.getBoundingClientRect = () => createDomRect({ top: 400 - window.scrollY, width: 960 })

  document.body.append(content, eventMarkets)
}

function flushAnimationFrame() {
  const callbacks = [...animationFrameCallbacks.values()]
  animationFrameCallbacks = new Map()

  act(() => {
    for (const callback of callbacks) {
      callback(performance.now())
    }
  })
}

describe('EventBackToTopButton', () => {
  beforeEach(() => {
    mocks.pathname = '/event/first-event'
    document.body.innerHTML = ''
    setWindowViewport({ scrollY: 0, width: 1280 })
    animationFrameId = 0
    animationFrameCallbacks = new Map()

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationFrameId += 1
      animationFrameCallbacks.set(animationFrameId, callback)
      return animationFrameId
    })

    window.cancelAnimationFrame = vi.fn((id: number) => {
      animationFrameCallbacks.delete(id)
    })
  })

  it('does not render from a stale home scroll position before navigation scroll settles', () => {
    createEventPageAnchors()
    setWindowViewport({ scrollY: 900, width: 1280 })

    render(<EventBackToTopButton />)

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('stays hidden when the event page scrolls to top after navigation', () => {
    createEventPageAnchors()
    setWindowViewport({ scrollY: 900, width: 1280 })

    render(<EventBackToTopButton />)

    setWindowViewport({ scrollY: 0, width: 1280 })
    flushAnimationFrame()
    flushAnimationFrame()

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('renders after navigation settles when the event page is actually scrolled past markets', () => {
    createEventPageAnchors()
    setWindowViewport({ scrollY: 900, width: 1280 })

    render(<EventBackToTopButton />)

    flushAnimationFrame()
    flushAnimationFrame()

    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
  })
})
