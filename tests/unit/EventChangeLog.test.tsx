import type { ConditionChangeLogEntry, Market } from '@/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useExtracted: () => (key: string, values?: Record<string, any>) => {
    if (!values) {
      return key
    }

    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
      key,
    )
  },
  useLocale: () => 'en',
}))

const { default: EventChangeLog } = await import('@/app/[locale]/(platform)/event/[slug]/_components/EventChangeLog')

describe('eventChangeLog', () => {
  it('renders condition change entries with old and new values', () => {
    const entries: ConditionChangeLogEntry[] = [
      {
        condition_id: 'cond-1',
        created_at: '2026-01-30T12:00:00.000Z',
        old_values: { metadata_hash: 'A', resolved: false },
        new_values: { metadata_hash: 'B', resolved: true },
      },
    ]
    const markets = [
      {
        condition_id: 'cond-1',
        title: 'Market One',
      },
    ] as unknown as Market[]

    render(<EventChangeLog entries={entries} markets={markets} />)

    expect(screen.getByText('Event changes')).toBeInTheDocument()
    expect(screen.getByText('metadata_hash')).toBeInTheDocument()
    expect(screen.getByText('resolved')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Market One')).toBeInTheDocument()
  })

  it('renders nothing when there are no entries', () => {
    const { container } = render(<EventChangeLog entries={[]} markets={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
