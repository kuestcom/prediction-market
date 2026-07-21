import { render, screen } from '@testing-library/react'
import AdminPageSkeleton, {
  AdminCalendarSkeleton,
  AdminPanelSkeleton,
} from '@/app/[locale]/admin/_components/AdminPageSkeleton'

describe('admin loading skeletons', () => {
  it('renders populated placeholders for route navigation', () => {
    const { container } = render(<AdminPageSkeleton />)

    expect(screen.getByRole('status', { name: 'Loading admin content' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(20)
  })

  it('renders populated panel and calendar placeholders', () => {
    const { container } = render(
      <>
        <AdminPanelSkeleton rowCount={2} />
        <AdminCalendarSkeleton />
      </>,
    )

    expect(screen.getByRole('status', { name: 'Loading calendar' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(40)
  })
})
