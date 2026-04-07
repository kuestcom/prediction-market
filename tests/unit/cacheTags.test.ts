import { describe, expect, it } from 'vitest'
import { cacheTags } from '@/lib/cache-tags'

describe('cacheTags', () => {
  it('builds stable tag strings', () => {
    expect(cacheTags.notifications('u1')).toBe('notifications:u1')
    expect(cacheTags.activity('slug')).toBe('activity:slug')
    expect(cacheTags.holders('cond')).toBe('holders:cond')
    expect(cacheTags.events('u1')).toBe('events:u1')
    expect(cacheTags.eventsList).toBe('events:list')
    expect(cacheTags.event('e1:u1')).toBe('event:e1:u1')
    expect(cacheTags.settings).toBe('settings')
  })
})
