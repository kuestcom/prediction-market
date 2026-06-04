import { act, fireEvent, render, screen } from '@testing-library/react'
import EventBackToTopButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventBackToTopButton'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

function setWindowScrollY(scrollY: number) {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: scrollY,
  })
}

describe('eventBackToTopButton', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setWindowScrollY(0)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render before the page has been scrolled far enough', () => {
    render(<EventBackToTopButton />)

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('renders after the page is scrolled past the threshold', () => {
    setWindowScrollY(401)

    render(<EventBackToTopButton />)

    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
  })

  it('scrolls to the top when clicked', () => {
    setWindowScrollY(401)

    render(<EventBackToTopButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('updates visibility when scroll position changes', () => {
    render(<EventBackToTopButton />)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()

    act(() => {
      setWindowScrollY(401)
      window.dispatchEvent(new Event('scroll'))
    })

    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()
  })
})
