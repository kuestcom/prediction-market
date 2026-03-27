import { render, screen } from '@testing-library/react'
import EventIconImage from '@/components/EventIconImage'

vi.mock('next/image', () => ({
  default: function MockNextImage({ fill: _fill, ...props }: any) {
    // eslint-disable-next-line next/no-img-element
    return <img {...props} />
  },
}))

describe('eventIconImage', () => {
  it('uses object-cover without forcing extra zoom by default', () => {
    const { container } = render(
      <EventIconImage
        src="/images/test.png"
        alt="Test event"
        sizes="40px"
        containerClassName="size-10 rounded-sm"
      />,
    )

    expect(container.firstChild).toHaveClass('relative', 'overflow-hidden', 'size-10', 'rounded-sm')
    expect(screen.getByAltText('Test event')).toHaveClass('object-cover', 'object-center')
    expect(screen.getByAltText('Test event')).not.toHaveClass('scale-[1.35]')
  })

  it('still merges custom image classes', () => {
    render(
      <EventIconImage
        src="/images/test.png"
        alt="Contained event"
        sizes="40px"
        imageClassName="rounded-md object-contain"
      />,
    )

    expect(screen.getByAltText('Contained event')).toHaveClass('rounded-md', 'object-contain')
  })
})
