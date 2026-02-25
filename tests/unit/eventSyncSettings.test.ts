import { describe, expect, it } from 'vitest'
import { getAutoDeployNewEventsEnabledFromSettings } from '@/lib/event-sync-settings'

describe('event sync settings helpers', () => {
  it('enables auto deploy by default when setting is missing', () => {
    expect(getAutoDeployNewEventsEnabledFromSettings(undefined)).toBe(true)
  })

  it('reads auto deploy disabled setting', () => {
    expect(getAutoDeployNewEventsEnabledFromSettings({
      events: {
        auto_deploy_new_events: {
          value: 'false',
          updated_at: new Date().toISOString(),
        },
      },
    })).toBe(false)
  })

  it('reads auto deploy enabled setting', () => {
    expect(getAutoDeployNewEventsEnabledFromSettings({
      events: {
        auto_deploy_new_events: {
          value: 'true',
          updated_at: new Date().toISOString(),
        },
      },
    })).toBe(true)
  })

  it('falls back to enabled on invalid value', () => {
    expect(getAutoDeployNewEventsEnabledFromSettings({
      events: {
        auto_deploy_new_events: {
          value: 'invalid',
          updated_at: new Date().toISOString(),
        },
      },
    })).toBe(true)
  })
})
