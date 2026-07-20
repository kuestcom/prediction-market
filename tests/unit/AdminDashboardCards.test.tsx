import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AdminDashboardSparkline from '@/app/[locale]/admin/_components/AdminDashboardSparkline'

describe('admin dashboard cards', () => {
  it('gives the sparkline image an accessible name', () => {
    render(
      <AdminDashboardSparkline
        ariaLabel="Daily registrations"
        format="count"
        points={[{ date: '2026-07-20', value: 3 }]}
      />,
    )

    expect(screen.getByRole('img', { name: 'Daily registrations' })).toBeInTheDocument()
  })
})
