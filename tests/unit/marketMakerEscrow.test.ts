import { describe, expect, it } from 'bun:test'

import { ESCROW_CAMPAIGN_STATUS, getEffectiveCampaignStatus, MARKET_MAKER_ESCROW_ABI } from '@/lib/market-maker-escrow'

describe('market maker escrow campaign status', () => {
  it('keeps Polymarket import fees outside the escrow campaign ABI', () => {
    const createCampaign = MARKET_MAKER_ESCROW_ABI.find(
      (entry) => entry.type === 'function' && entry.name === 'createCampaign',
    )
    expect(
      createCampaign && 'inputs' in createCampaign ? createCampaign.inputs[0]?.components?.map(({ name }) => name) : [],
    ).not.toContain('deploymentFee')
  })

  it('presents an active campaign as review after its service period ends', () => {
    expect(getEffectiveCampaignStatus(ESCROW_CAMPAIGN_STATUS.active, 1_000, 1_000)).toBe(ESCROW_CAMPAIGN_STATUS.review)
  })

  it('does not rewrite terminal or disputed states', () => {
    expect(getEffectiveCampaignStatus(ESCROW_CAMPAIGN_STATUS.disputed, 1_000, 2_000)).toBe(
      ESCROW_CAMPAIGN_STATUS.disputed,
    )
    expect(getEffectiveCampaignStatus(ESCROW_CAMPAIGN_STATUS.paid, 1_000, 2_000)).toBe(ESCROW_CAMPAIGN_STATUS.paid)
  })
})
