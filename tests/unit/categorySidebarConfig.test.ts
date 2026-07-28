import { describe, expect, it } from 'vitest'
import {
  resolveCategorySidebarData,
  resolveCategorySidebarPageTitle,
} from '@/lib/category-sidebar-config'

describe('category sidebar config', () => {
  it.each([
    ['5M', '5 Min Crypto'],
    ['15M', '15 Min Crypto'],
    ['hourly', '1 Hour Crypto'],
    ['4hour', '4 Hours Crypto'],
    ['daily', 'Daily Crypto'],
    ['weekly', 'Weekly Crypto'],
    ['monthly', 'Monthly Crypto'],
    ['yearly', 'Yearly Crypto'],
    ['targets', 'Targets'],
    ['pre-market', 'Pre-Market'],
  ])('resolves the %s page heading', (activeSubcategorySlug, expectedTitle) => {
    expect(resolveCategorySidebarPageTitle({
      activeSubcategorySlug,
      categorySlug: 'crypto',
      categoryTitle: 'Crypto',
      childs: [
        { slug: '5M', name: '5 Min' },
        { slug: '15M', name: '15 Min' },
        { slug: 'hourly', name: '1 Hour' },
        { slug: '4hour', name: '4 Hours' },
        { slug: 'daily', name: 'Daily' },
        { slug: 'weekly', name: 'Weekly' },
        { slug: 'monthly', name: 'Monthly' },
        { slug: 'yearly', name: 'Yearly' },
        { slug: 'targets', name: 'Targets' },
        { slug: 'pre-market', name: 'Pre-Market' },
      ],
    })).toBe(expectedTitle)
  })

  it('builds the full predefined crypto sidebar with zero-count fallbacks', () => {
    const result = resolveCategorySidebarData({
      categorySlug: 'crypto',
      categoryCount: 3,
      childs: [
        { slug: 'bitcoin', name: 'Bitcoin', count: 1 },
        { slug: 'daily', name: 'Daily', count: 3 },
        { slug: 'targets', name: 'Targets', count: 4 },
        { slug: 'institutions', name: 'Institutions', count: 2 },
        { slug: 'solana', name: 'Solana', count: 2 },
        { slug: 'crypto-prices', name: 'Crypto Prices', count: 3 },
      ],
    })

    expect(result.childs.slice(0, 5)).toEqual([
      { slug: '5M', name: '5 Min', count: 0 },
      { slug: '15M', name: '15 Min', count: 0 },
      { slug: 'hourly', name: '1 Hour', count: 0 },
      { slug: '4hour', name: '4 Hours', count: 0 },
      { slug: 'daily', name: 'Daily', count: 3 },
    ])
    expect(result.childs).toContainEqual({ slug: 'institutions', name: 'Institutions', count: 2 })
    expect(result.childs).toContainEqual({ slug: 'crypto-prices', name: 'Crypto Prices', count: 3 })
    expect(result.sidebarItems?.slice(0, 4)).toMatchObject([
      { type: 'link', slug: 'crypto', count: 3, isAll: true, icon: 'all-grid' },
      { type: 'link', slug: '5M', label: '5 Min', count: 0, icon: 'five-minute' },
      { type: 'link', slug: '15M', label: '15 Min', count: 0, icon: 'fifteen-minute' },
      { type: 'link', slug: 'hourly', label: '1 Hour', count: 0, icon: 'hourly' },
    ])
    expect(result.sidebarItems?.map(item => item.type === 'link' ? item.slug : item.key)).toEqual([
      'crypto',
      '5M',
      '15M',
      'hourly',
      '4hour',
      'daily',
      'weekly',
      'monthly',
      'yearly',
      'targets',
      'pre-market',
      'institutions',
      'industry',
      'protocol-metrics',
      'crypto-assets',
      'bitcoin',
      'ethereum',
      'solana',
      'xrp',
      'dogecoin',
      'bnb',
      'microstrategy',
    ])
    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'targets',
      label: 'Targets',
      count: 4,
      icon: 'targets',
    })
    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'bitcoin',
      label: 'Bitcoin',
      count: 1,
      icon: 'bitcoin',
    })
    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'microstrategy',
      label: 'MicroStrategy',
      count: 0,
      icon: 'microstrategy',
    })
  })

  it('uses localized child labels in configured sidebar items', () => {
    const result = resolveCategorySidebarData({
      categorySlug: 'crypto',
      categoryCount: 3,
      childs: [
        { slug: 'targets', name: 'Alvos', count: 2 },
        { slug: 'institutions', name: 'Instituições', count: 1 },
      ],
    })

    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'targets',
      label: 'Alvos',
      count: 2,
      icon: 'targets',
    })
    expect(result.childs).toContainEqual({
      slug: 'institutions',
      name: 'Instituições',
      count: 1,
    })
  })

  it('builds a default sidebar for non-configured categories with a counted all item', () => {
    const result = resolveCategorySidebarData({
      categorySlug: 'economy',
      categoryCount: 4,
      childs: [{ slug: 'fed-rates', name: 'Fed Rates', count: 4 }],
    })

    expect(result.childs).toEqual([{ slug: 'fed-rates', name: 'Fed Rates', count: 4 }])
    expect(result.sidebarItems).toEqual([
      { type: 'link', slug: 'economy', label: 'All', count: 4, isAll: true },
      { type: 'link', slug: 'fed-rates', label: 'Fed Rates', count: 4 },
    ])
  })

  it('builds the finance sidebar with href overrides and hidden-count items', () => {
    const result = resolveCategorySidebarData({
      categorySlug: 'finance',
      categoryCount: 9,
      childs: [
        { slug: 'daily', name: 'Daily', count: 2 },
        { slug: 'earnings', name: 'Earnings', count: 5 },
        { slug: 'collectibles', name: 'Collectibles', count: 1 },
        { slug: 'fed-rates', name: 'Fed Rates', count: 4 },
      ],
    })

    expect(result.childs.slice(0, 5)).toEqual([
      { slug: 'daily', name: 'Daily', count: 2 },
      { slug: 'weekly', name: 'Weekly', count: 0 },
      { slug: 'monthly', name: 'Monthly', count: 0 },
      { slug: 'stocks', name: 'Stocks', count: 0 },
      { slug: 'earnings', name: 'Earnings', count: 5 },
    ])
    expect(result.childs).not.toContainEqual({ slug: 'earnings-calendar', name: 'Earnings Calendar', count: 0 })
    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'earnings-calendar',
      label: 'Earnings Calendar',
      href: '/earnings',
      icon: 'earnings-calendar',
      count: undefined,
    })
    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'collectibles',
      label: 'Collectibles',
      icon: 'collectibles',
      count: undefined,
    })
  })

  it('builds the weather sidebar with the predefined weather categories', () => {
    const result = resolveCategorySidebarData({
      categorySlug: 'weather',
      categoryCount: 6,
      childs: [
        { slug: 'temperature', name: 'Temperature', count: 3 },
        { slug: 'earthquakes', name: 'Earthquakes', count: 2 },
      ],
    })

    expect(result.childs.slice(0, 4)).toEqual([
      { slug: 'temperature', name: 'Temperature', count: 3 },
      { slug: 'precipitation', name: 'Precipitation', count: 0 },
      { slug: 'global', name: 'Global', count: 0 },
      { slug: 'tornadoes', name: 'Tornadoes', count: 0 },
    ])
    expect(result.sidebarItems?.slice(0, 3)).toMatchObject([
      { type: 'link', slug: 'weather', count: 6, isAll: true, icon: 'all-grid' },
      { type: 'link', slug: 'temperature', label: 'Temperature', count: 3, icon: 'temperature' },
      { type: 'link', slug: 'precipitation', label: 'Precipitation', count: 0, icon: 'precipitation' },
    ])
    expect(result.sidebarItems).toContainEqual({
      type: 'link',
      slug: 'earthquakes',
      label: 'Earthquakes',
      count: 2,
      icon: 'earthquakes',
    })
  })
})
