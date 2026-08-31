import { describe, expect, it } from 'vitest'

import type { HomeFeaturedEventCard, Market } from '@/types'

import {
  localizeHomeEventCardTitle,
  localizeHomeFeaturedDateLabel,
  localizeHomeFeaturedMarketDates,
  resolveHomeFeaturedFullLidTitleValues,
} from '@/lib/home-featured-localization'
import { normalizeLocalizedUpOrDownTitle } from '@/lib/up-or-down-localization'

describe('home featured localization', () => {
  it('localizes date-only market labels for Chinese', () => {
    expect(localizeHomeFeaturedDateLabel('September 1', 'zh')).toBe('9月1日')
    expect(localizeHomeFeaturedDateLabel('August 31', 'zh')).toBe('8月31日')
    expect(localizeHomeFeaturedDateLabel('September 5', 'zh')).toBe('9月5日')
  })

  it('localizes outcome and chart market labels without changing the source item', () => {
    const market = {
      title: 'September 1',
      short_title: 'September 1',
      metadata: { short_title: 'September 1' },
      outcomes: [{ outcome_text: 'September 1' }],
    } as Market
    const item = {
      event: { markets: [market] },
      topOutcomes: [{ label: 'September 1' }],
    } as HomeFeaturedEventCard

    const localized = localizeHomeFeaturedMarketDates(item, 'zh')

    expect(localized.event.markets[0]).toMatchObject({
      title: '9月1日',
      short_title: '9月1日',
      metadata: { short_title: '9月1日' },
      outcomes: [{ outcome_text: '9月1日' }],
    })
    expect(localized.topOutcomes[0]?.label).toBe('9月1日')
    expect(item.event.markets[0]?.title).toBe('September 1')
  })

  it('extracts localized values from the featured White House title', () => {
    expect(
      resolveHomeFeaturedFullLidTitleValues(
        'Will the White House call a full lid by 6:30 PM? (August 31 - September 5)',
        'zh',
      ),
    ).toEqual({
      time: '18:30',
      startDate: '8月31日',
      endDate: '9月5日',
    })
  })

  it('localizes English and partially translated shared-market titles', () => {
    expect(localizeHomeEventCardTitle('WTI Crude Oil (WTI) Up or Down on August 31?', 'zh')).toBe(
      '8月31日WTI Crude Oil (WTI)会上涨还是下跌？',
    )
    expect(localizeHomeEventCardTitle('S&P 500 (SPX) Up or Down on August 31?', 'zh')).toBe(
      '8月31日S&P 500 (SPX)会上涨还是下跌？',
    )
    expect(localizeHomeEventCardTitle('Gold (XAUUSD) Up or Down on August 31?', 'zh')).toBe(
      '8月31日Gold (XAUUSD)会上涨还是下跌？',
    )
    expect(localizeHomeEventCardTitle('8月 31日 WTI Crude Oil (WTI)会上涨还是下跌?', 'zh')).toBe(
      '8月31日WTI Crude Oil (WTI)会上涨还是下跌？',
    )
    expect(localizeHomeEventCardTitle('本周 Trump approval会上涨还是下跌?', 'zh')).toBe(
      '本周特朗普支持率会上涨还是下跌？',
    )
    expect(localizeHomeEventCardTitle('Trump approval sobe ou desce esta semana?', 'pt')).toBe(
      'Aprovação de Trump sobe ou desce esta semana?',
    )
    expect(localizeHomeEventCardTitle('BTC会上涨还是下跌 4h', 'zh')).toBe('BTC会上涨还是下跌 4h')
  })

  it('does not partially translate ordinary titles containing Trump approval', () => {
    expect(localizeHomeEventCardTitle('Trump approval poll closes tomorrow', 'pt')).toBe(
      'Trump approval poll closes tomorrow',
    )
  })

  it('recognizes the Arabic up-or-down marker without replacing the marker', () => {
    expect(normalizeLocalizedUpOrDownTitle('pt', 'Trump approval صعود أم هبوط this week?')).toBe(
      'Aprovação de Trump صعود أم هبوط this week?',
    )
  })

  it('localizes a date-only primary market question used as the card title', () => {
    expect(localizeHomeEventCardTitle('September 1', 'zh')).toBe('9月1日')
  })

  it('leaves unrelated market labels and titles alone', () => {
    expect(localizeHomeFeaturedDateLabel('Above $100,000', 'zh')).toBe('Above $100,000')
    expect(resolveHomeFeaturedFullLidTitleValues('Will Bitcoin reach $200k?', 'zh')).toBeNull()
  })
})
