import {
  formatSportsEventCountdown,
  formatSportsEventLocalStartLabels,
  formatSportsEventStartLabels,
  formatSportsRelatedGameLocalStartLabel,
  formatSportsRelatedGameStartLabel,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-utils'

describe('sportsEventCenterUtils', () => {
  it('formats event countdowns with hours, minutes, and seconds', () => {
    const currentTimestamp = Date.parse('2026-08-06T12:00:00.000Z')
    const startTimestamp = currentTimestamp + 17 * 3_600_000 + 39 * 60_000 + 59_000

    expect(formatSportsEventCountdown(startTimestamp, currentTimestamp)).toBe('17h 39m 59s')
  })

  it('includes days and clamps elapsed countdowns to zero', () => {
    const currentTimestamp = Date.parse('2026-08-06T12:00:00.000Z')

    expect(formatSportsEventCountdown(currentTimestamp + 2 * 86_400_000 + 60_000, currentTimestamp)).toBe('2d 0h 1m 0s')
    expect(formatSportsEventCountdown(currentTimestamp - 1_000, currentTimestamp)).toBe('0h 0m 0s')
  })

  it('formats event hero start labels in ET', () => {
    expect(formatSportsEventStartLabels(Date.parse('2026-06-09T12:00:00.000Z'), 'en-US')).toEqual({
      timeLabel: '8:00 AM ET',
      dayLabel: 'June 9',
    })
  })

  it('formats event hero local start labels with the browser time zone', () => {
    expect(
      formatSportsEventLocalStartLabels(Date.parse('2026-06-09T12:00:00.000Z'), 'en-US', 'America/Sao_Paulo'),
    ).toEqual({
      timeLabel: '9:00 AM',
      dayLabel: 'June 9',
    })
  })

  it('formats related game start labels in ET without locale-specific connector text', () => {
    expect(formatSportsRelatedGameStartLabel(new Date('2026-07-10T19:00:00.000Z'), 'en')).toBe('Jul 10, 3:00 PM ET')
  })

  it('formats related game local start labels after hydration', () => {
    expect(
      formatSportsRelatedGameLocalStartLabel(new Date('2026-07-10T19:00:00.000Z'), 'en', 'America/Sao_Paulo'),
    ).toBe('Jul 10, 4:00 PM')
  })
})
