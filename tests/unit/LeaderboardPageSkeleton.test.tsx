import { render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import LeaderboardPageSkeleton from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPageSkeleton'

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string, values?: Record<string, string>) =>
    message.replace(/\{(\w+)\}/g, (_, key: string) => values?.[key] ?? ''),
}))

void mock.module('@/i18n/navigation', () => ({
  Link: function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  },
}))

describe('leaderboardPageSkeleton', () => {
  it('keeps the leaderboard controls and sidebar visible', () => {
    render(<LeaderboardPageSkeleton />)

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Monthly' })).toBeVisible()
    expect(screen.getAllByRole('combobox').some((select) => select.textContent?.startsWith('All Categories'))).toBe(
      true,
    )
    expect(screen.getByRole('textbox', { name: 'Search by name' })).toBeVisible()
    expect(screen.getAllByRole('combobox').some((select) => select.textContent?.startsWith('Profit/Loss'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Volume' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Biggest wins this month' })).toBeVisible()
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
  })
})
