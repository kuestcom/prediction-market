import type { Address } from 'viem'
import type { PublicRuntimeConfig } from '@/lib/public-runtime-config'
import { normalizeAddress } from '@/lib/wallet'
import { normalizeLiquidityVaultSlug } from './deployment'

export const liquidityVaultAbi = [
  {
    type: 'function',
    name: 'accountedAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'availableWithdrawalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'categorySlug',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
  },
  {
    type: 'function',
    name: 'claimDeposit',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint64', name: 'epoch' }],
    outputs: [{ type: 'uint256', name: 'shares' }],
  },
  {
    type: 'function',
    name: 'claimWithdraw',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [{ type: 'uint256', name: 'assets' }],
  },
  {
    type: 'function',
    name: 'claimableWithdrawalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'currentEpoch',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64', name: '' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8', name: '' }],
  },
  {
    type: 'function',
    name: 'depositSharePriceByEpoch',
    stateMutability: 'view',
    inputs: [{ type: 'uint64', name: 'epoch' }],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'lastFinalizedEpoch',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64', name: '' }],
  },
  {
    type: 'function',
    name: 'lastSharePrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'lockedUntil',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
  },
  {
    type: 'function',
    name: 'pendingDepositAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'pendingDepositOf',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'account' },
      { type: 'uint64', name: 'epoch' },
    ],
    outputs: [
      { type: 'uint256', name: 'assets' },
      { type: 'bool', name: 'claimed' },
    ],
  },
  {
    type: 'function',
    name: 'previewDepositAtPrice',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256', name: 'assets' },
      { type: 'uint256', name: 'price' },
    ],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'previewWithdrawAtPrice',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256', name: 'shares' },
      { type: 'uint256', name: 'price' },
    ],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'requestDeposit',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'assets' }],
    outputs: [{ type: 'uint64', name: 'epoch' }],
  },
  {
    type: 'function',
    name: 'requestWithdraw',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'shares' }],
    outputs: [{ type: 'uint256', name: 'requestId' }],
  },
  {
    type: 'function',
    name: 'sharePrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'strategyAllocatedAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
  },
  {
    type: 'function',
    name: 'totalQueuedWithdrawalShares',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'withdrawableBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'withdrawalRequestCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'withdrawalRequests',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: '' }],
    outputs: [
      { type: 'address', name: 'owner' },
      { type: 'uint64', name: 'epoch' },
      { type: 'uint256', name: 'sharesRemaining' },
      { type: 'uint256', name: 'assetsClaimable' },
      { type: 'bool', name: 'completed' },
    ],
  },
  {
    type: 'event',
    name: 'DepositClaimed',
    inputs: [
      { type: 'address', name: 'account', indexed: true },
      { type: 'uint64', name: 'epoch', indexed: true },
      { type: 'uint256', name: 'assets', indexed: false },
      { type: 'uint256', name: 'shares', indexed: false },
      { type: 'uint256', name: 'lockedUntil', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DepositRequested',
    inputs: [
      { type: 'address', name: 'account', indexed: true },
      { type: 'uint64', name: 'epoch', indexed: true },
      { type: 'uint256', name: 'assets', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalClaimed',
    inputs: [
      { type: 'address', name: 'account', indexed: true },
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint256', name: 'assets', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalRequested',
    inputs: [
      { type: 'address', name: 'account', indexed: true },
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint64', name: 'epoch', indexed: true },
      { type: 'uint256', name: 'shares', indexed: false },
    ],
    anonymous: false,
  },
] as const

export const liquidityErc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool', name: '' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8', name: '' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
  },
] as const

export function getLiquidityVaultAddress(
  runtimeConfig: PublicRuntimeConfig,
  slug?: string | null,
): Address | null {
  const vaultSlug = normalizeLiquidityVaultSlug(slug)
  if (!vaultSlug) {
    return null
  }

  return normalizeAddress(runtimeConfig.xlayerLiquidityVaultAddresses[vaultSlug])
}

export function getLiquidityVaultEntries(runtimeConfig: PublicRuntimeConfig) {
  return Object.entries(runtimeConfig.xlayerLiquidityVaultAddresses)
    .map(([slug, address]) => {
      const vaultSlug = normalizeLiquidityVaultSlug(slug)
      const vaultAddress = normalizeAddress(address)
      return vaultSlug && vaultAddress ? { slug: vaultSlug, address: vaultAddress } : null
    })
    .filter((entry): entry is { slug: NonNullable<ReturnType<typeof normalizeLiquidityVaultSlug>>, address: Address } => Boolean(entry))
}
