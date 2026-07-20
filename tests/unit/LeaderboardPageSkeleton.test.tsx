import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LeaderboardPageSkeleton from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPageSkeleton'

vi.mock('@/i18n/navigation', () => ({
  Link: function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) {
    return <a href={href}>{children}</a>
  },
}))

describe('leaderboardPageSkeleton', () => {
  it('keeps the leaderboard controls and sidebar visible', () => {
    render(<LeaderboardPageSkeleton />)

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Monthly' })).toBeVisible()
    expect(screen.getAllByRole('combobox').map(select => select.textContent)).toContain('All Categories')
    expect(screen.getByRole('textbox', { name: 'Search by name' })).toBeVisible()
    expect(screen.getAllByRole('combobox').map(select => select.textContent)).toContain('Profit/Loss')
    expect(screen.getByRole('button', { name: 'Volume' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Biggest wins this month' })).toBeVisible()
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
  })
})
