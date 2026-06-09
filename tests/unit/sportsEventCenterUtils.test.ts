import { formatSportsEventStartLabels } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-utils'

describe('sportsEventCenterUtils', () => {
  it('formats event hero start labels in ET', () => {
    expect(formatSportsEventStartLabels(Date.parse('2026-06-09T12:00:00.000Z'), 'en-US')).toEqual({
      timeLabel: '8:00 AM ET',
      dayLabel: 'June 9',
    })
  })
})
