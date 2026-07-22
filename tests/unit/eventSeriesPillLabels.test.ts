import { describe, expect, it } from 'vitest'
import { resolveLiveSeriesPillLabel } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventSeriesPillLabels'

describe('resolveLiveSeriesPillLabel', () => {
  it('shows only the date for daily series', () => {
    expect(resolveLiveSeriesPillLabel({
      dateLabel: 'Jul 23',
      isDailySeries: true,
      isToday: true,
      timeLabel: '12 PM',
    })).toBe('Jul 23')

    expect(resolveLiveSeriesPillLabel({
      dateLabel: 'Jul 24',
      isDailySeries: true,
      isToday: false,
      timeLabel: '12 PM',
    })).toBe('Jul 24')
  })

  it('keeps time labels for intraday series', () => {
    expect(resolveLiveSeriesPillLabel({
      dateLabel: 'Jul 23',
      isDailySeries: false,
      isToday: true,
      timeLabel: '2 PM',
    })).toBe('2 PM')

    expect(resolveLiveSeriesPillLabel({
      dateLabel: 'Jul 24',
      isDailySeries: false,
      isToday: false,
      timeLabel: '2 PM',
    })).toBe('2 PM Jul 24')
  })
})
