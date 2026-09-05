import { describe, expect, it } from 'bun:test'

import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import { resolveResolutionProposalValue } from '@/app/[locale]/(platform)/profile/_utils/PublicResolutionUtils'

function createProposal(overrides: Partial<DataApiRewardProposal> = {}): DataApiRewardProposal {
  return {
    id: 'proposal-1',
    proposalId: 'proposal-1',
    market: {
      id: 'market-1',
      adapter: null,
      questionId: null,
      lockDuration: '172800',
      conditionId: null,
      title: 'Market',
      marketSlug: 'market',
      icon: '',
      eventSlug: 'event',
      eventTitle: 'Event',
      eventIcon: '',
      eventSeriesSlug: null,
      yesLabel: 'Up',
      noLabel: 'Down',
    },
    creator: '0xcreator',
    wallet: '0xwallet',
    side: 2,
    status: 'resolved',
    submittedAt: '1786118400',
    withdrawalRequestedAt: null,
    withdrawalAvailableAt: null,
    correct: true,
    rewardEligible: true,
    bondBeneficiary: '0xwallet',
    bondAmount: '300000000',
    rewardAmount: '4000000',
    transactionHash: '0xtx',
    profile: { username: 'resolver', avatarUrl: '' },
    history: { correct: '1', incorrect: '0' },
    ...overrides,
  }
}

describe('resolution proposal value', () => {
  it('shows only the bounty for a correct rewarded proposal', () => {
    expect(resolveResolutionProposalValue(createProposal())).toEqual({ label: '+$4', positive: true })
  })

  it('shows zero for a correct proposal without a bounty', () => {
    expect(resolveResolutionProposalValue(createProposal({ rewardAmount: '0' }))).toEqual({
      label: '$0',
      positive: false,
    })
  })

  it('preserves a positive sub-cent bounty instead of styling a rounded zero as positive', () => {
    expect(resolveResolutionProposalValue(createProposal({ rewardAmount: '4000' }))).toEqual({
      label: '+$0.004',
      positive: true,
    })
  })

  it('shows the lost bond for an incorrect proposal', () => {
    expect(resolveResolutionProposalValue(createProposal({ correct: false }))).toEqual({
      label: '-$300',
      positive: false,
    })
  })

  it('does not render a negative sign for a zero incorrect bond', () => {
    expect(resolveResolutionProposalValue(createProposal({ correct: false, bondAmount: '0' }))).toEqual({
      label: '$0',
      positive: false,
    })
  })

  it('does not treat a pending bond as lost', () => {
    expect(resolveResolutionProposalValue(createProposal({ correct: null, status: 'active' }))).toEqual({
      label: '—',
      positive: false,
    })
  })
})
