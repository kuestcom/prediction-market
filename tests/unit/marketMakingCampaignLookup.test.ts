import { describe, expect, it } from 'vitest'

import {
  resolveCampaignLookupId,
  resolveCampaignsInstanceKey,
} from '@/app/[locale]/admin/market-making/_components/market-making-campaign-lookup'

describe('market-making campaign lookup', () => {
  it('clears a dismissed campaign deep link', () => {
    expect(
      resolveCampaignLookupId({
        dismissedLinkedCampaignId: '123',
        linkedCampaignId: '123',
        lookupId: null,
      }),
    ).toBeNull()
  })

  it('allows an explicit lookup after dismissing the deep link', () => {
    expect(
      resolveCampaignLookupId({
        dismissedLinkedCampaignId: '123',
        linkedCampaignId: '123',
        lookupId: '456',
      }),
    ).toBe('456')
  })

  it('handles a new campaign deep link', () => {
    expect(
      resolveCampaignLookupId({
        dismissedLinkedCampaignId: '123',
        linkedCampaignId: '456',
        lookupId: null,
      }),
    ).toBe('456')
  })

  it('remounts campaign state when client navigation changes the linked id', () => {
    expect(resolveCampaignsInstanceKey('123')).toBe('linked-campaign:123')
    expect(resolveCampaignsInstanceKey('456')).toBe('linked-campaign:456')
    expect(resolveCampaignsInstanceKey(null)).toBe('campaigns')
  })
})
