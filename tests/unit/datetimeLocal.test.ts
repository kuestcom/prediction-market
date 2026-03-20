import { describe, expect, it } from 'vitest'
import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

describe('normalizeDateTimeLocalValue', () => {
  it('preserves browser-safe datetime-local values', () => {
    expect(normalizeDateTimeLocalValue('2026-03-31T12:30')).toBe('2026-03-31T12:30')
  })

  it('strips seconds from local datetime strings', () => {
    expect(normalizeDateTimeLocalValue('2026-03-31T12:30:45')).toBe('2026-03-31T12:30')
    expect(normalizeDateTimeLocalValue('2026-03-31 12:30:45')).toBe('2026-03-31T12:30')
  })

  it('normalizes date-only values to local midnight', () => {
    expect(normalizeDateTimeLocalValue('2026-03-31')).toBe('2026-03-31T00:00')
  })

  it('converts timezone-qualified timestamps into local datetime-local values', () => {
    const input = '2026-03-31T12:30:00.000Z'
    const expected = formatDateTimeLocal(new Date(input))

    expect(normalizeDateTimeLocalValue(input)).toBe(expected)
  })

  it('returns an empty string for invalid values', () => {
    expect(normalizeDateTimeLocalValue('not-a-date')).toBe('')
  })
})
