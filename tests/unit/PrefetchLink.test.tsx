import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  link: vi.fn(),
  prefetch: vi.fn(),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean | 'auto' | null }) => {
    mocks.link(props)
    return <a {...props}>{children}</a>
  },
  useRouter: () => ({ prefetch: mocks.prefetch }),
}))

import PrefetchLink from '@/components/PrefetchLink'

describe('PrefetchLink', () => {
  beforeEach(() => {
    mocks.link.mockReset()
    mocks.prefetch.mockReset()
  })

  it('prefetches internal routes on hover, focus, and pointer down', () => {
    const { getByRole } = render(<PrefetchLink href="/portfolio">Portfolio</PrefetchLink>)
    const link = getByRole('link')

    fireEvent.pointerEnter(link)
    fireEvent.focus(link)
    fireEvent.pointerDown(link)

    expect(mocks.prefetch).toHaveBeenCalledTimes(3)
    expect(mocks.prefetch).toHaveBeenCalledWith('/portfolio')
    expect(mocks.link.mock.calls.at(-1)?.[0].prefetch).toBe('auto')
  })

  it('does not prefetch external routes or explicitly disabled links', () => {
    const { getAllByRole } = render(
      <>
        <PrefetchLink href="https://example.com">External</PrefetchLink>
        <PrefetchLink href="/docs" prefetch={false}>
          Docs
        </PrefetchLink>
      </>,
    )

    for (const link of getAllByRole('link')) {
      fireEvent.pointerEnter(link)
      fireEvent.focus(link)
      fireEvent.pointerDown(link)
    }

    expect(mocks.prefetch).not.toHaveBeenCalled()
  })

  it('preserves an explicit prefetch opt-out', () => {
    render(
      <PrefetchLink href="/docs" prefetch={false}>
        Docs
      </PrefetchLink>,
    )

    expect(mocks.link.mock.calls.at(-1)?.[0].prefetch).toBe(false)
  })
})
