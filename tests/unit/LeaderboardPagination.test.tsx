import { render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import LeaderboardPagination from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPagination'

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

describe('leaderboardPagination', () => {
  it('hides pagination when there are no leaderboard items', () => {
    render(<LeaderboardPagination hasItems={false} hasNextPage={false} page={1} setPageValue={mock()} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not expose future pages after a partial response', () => {
    render(<LeaderboardPagination hasItems hasNextPage={false} page={2} setPageValue={mock()} />)

    expect(screen.getByRole('button', { name: '1' })).toBeVisible()
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument()
    expect(screen.queryByText('…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })
})
