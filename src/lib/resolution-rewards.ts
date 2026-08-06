import type { Address, Hex } from 'viem'

import { encodePacked, keccak256 } from 'viem'

import { YES_OR_NO_IDENTIFIER } from '@/lib/direct-resolution'

export const RESOLUTION_REWARD_SIDE = {
  no: 1,
  yes: 2,
} as const

export const RESOLUTION_REWARDS_ABI = [
  {
    type: 'function',
    name: 'claimable',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitProposal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'side', type: 'uint8' },
    ],
    outputs: [{ name: 'proposalId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestWithdrawal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'releaseExpiredProposal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ProposalSubmitted',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'side', type: 'uint8', indexed: false },
      { name: 'bond', type: 'uint256', indexed: false },
      { name: 'submittedAt', type: 'uint64', indexed: false },
    ],
  },
] as const

export function getResolutionRewardMarketId(requester: Address, ancillaryData: Hex): Hex {
  return keccak256(encodePacked(['address', 'bytes32', 'bytes'], [requester, YES_OR_NO_IDENTIFIER, ancillaryData]))
}
