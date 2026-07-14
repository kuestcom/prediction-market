import { describe, expect, it } from 'vitest'

import { isMenuRowForVertical } from '@/lib/sports-menu-vertical'

describe('sports menu vertical classification', () => {
  it.each([
    'group-esports-13',
    'group-esports-14',
    'group-esports-999',
  ])('keeps legacy numeric esports containers in the sports menu: %s', (id) => {
    expect(isMenuRowForVertical({ id }, 'sports')).toBe(true)
    expect(isMenuRowForVertical({ id }, 'esports')).toBe(false)
  })

  it.each([
    'group-esports-league-of-legends',
    'group-esports-13-link-starcraft-ii-sports-starcraft-2-games-10',
    'sidebar-esports-category-fighting-games-123',
  ])('classifies esports games and links independently of the legacy container: %s', (id) => {
    expect(isMenuRowForVertical({ id }, 'sports')).toBe(false)
    expect(isMenuRowForVertical({ id }, 'esports')).toBe(true)
  })

  it('keeps ordinary sports rows out of the esports menu', () => {
    expect(isMenuRowForVertical({ id: 'group-soccer-11' }, 'sports')).toBe(true)
    expect(isMenuRowForVertical({ id: 'group-soccer-11' }, 'esports')).toBe(false)
  })
})
