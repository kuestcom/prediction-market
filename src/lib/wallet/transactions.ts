import type { Address, Hex, TypedDataDomain } from 'viem'
import {
  encodeFunctionData,
  erc20Abi,
  erc1155Abi,
  zeroAddress,
} from 'viem'
import { addressToBuilderCode } from '@/lib/builder-code'
import {
  COLLATERAL_TOKEN_ADDRESS,
  CONDITIONAL_TOKENS_CONTRACT,
  CTF_AUTO_REDEEM_ADDRESS,
  CTF_EXCHANGE_ADDRESS,
  DEPOSIT_WALLET_FACTORY_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
  ZERO_COLLECTION_ID,
} from '@/lib/contracts'
import {
  DEPOSIT_WALLET_BATCH_DEADLINE_SECONDS,
  getDepositWalletDomain,
} from '@/lib/deposit-wallet'

export interface WalletCall {
  target: `0x${string}`
  value: string
  data: `0x${string}`
}

interface DepositWalletBatchMessage extends Record<string, unknown> {
  wallet: Address
  nonce: bigint
  deadline: bigint
  calls: {
    target: Address
    value: bigint
    data: Hex
  }[]
}

export interface DepositWalletTypedDataPayload {
  domain: TypedDataDomain
  types: typeof DEPOSIT_WALLET_BATCH_TYPES
  primaryType: 'Batch'
  message: DepositWalletBatchMessage
  depositWalletParams: DepositWalletParams
}

export interface DepositWalletParams {
  depositWallet: string
  deadline: string
  calls: {
    target: string
    value: string
    data: string
  }[]
}

export interface WalletTransactionRequestPayload {
  type: 'WALLET'
  from: string
  to: string
  data: string
  value: string
  nonce: string
  signature: string
  signatureParams: {
    depositWalletParams: DepositWalletParams
  }
  depositWalletParams: DepositWalletParams
  metadata?: string
}

interface ReferralOptions {
  referrer: `0x${string}`
  affiliate?: `0x${string}`
  affiliateSharePercent?: number
  exchanges?: `0x${string}`[]
}

interface ClaimFeesOptions {
  exchanges?: `0x${string}`[]
}

interface ConditionalPositionArgs {
  contract?: `0x${string}`
  collateralToken?: `0x${string}`
  parentCollectionId?: `0x${string}`
  conditionId: `0x${string}`
  partition: Array<string | number | bigint>
  amount: string
}

interface ConditionalRedeemArgs {
  contract?: `0x${string}`
  collateralToken?: `0x${string}`
  parentCollectionId?: `0x${string}`
  conditionId: `0x${string}`
  indexSets: Array<string | number | bigint>
}

interface ConvertPositionsArgs {
  contract?: `0x${string}`
  marketId: `0x${string}`
  indexSet: string | number | bigint
  amount: string | number | bigint
}

interface NegRiskSplitArgs {
  conditionId: `0x${string}`
  amount: string | number | bigint
  contract?: `0x${string}`
}

interface NegRiskRedeemArgs {
  conditionId: `0x${string}`
  yesAmount: string | number | bigint
  noAmount: string | number | bigint
  contract?: `0x${string}`
}

const MAX_ALLOWANCE = (1n << 256n) - 1n

export const DEPOSIT_WALLET_BATCH_TYPES = {
  Call: [
    { name: 'target', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
  Batch: [
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'calls', type: 'Call[]' },
  ],
} as const

const conditionalTokensAbi = [
  {
    name: 'splitPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'parentCollectionId', type: 'bytes32' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'partition', type: 'uint256[]' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'mergePositions',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'parentCollectionId', type: 'bytes32' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'partition', type: 'uint256[]' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'redeemPositions',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'parentCollectionId', type: 'bytes32' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'indexSets', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const

const exchangeReferralAbi = [
  {
    name: 'setReferral',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'builder', type: 'bytes32' },
      { name: 'affiliate', type: 'address' },
      { name: 'affiliatePercentage', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const exchangeFeeAbi = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const negRiskAdapterAbi = [
  {
    name: 'convertPositions',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'indexSet', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'splitPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'conditionId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'redeemPositions',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'conditionId', type: 'bytes32' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const

function parseAmountToBaseUnits(amount: string | number | bigint, decimals: number): bigint {
  if (typeof amount === 'bigint') {
    return amount
  }

  const normalized = typeof amount === 'number' ? amount.toString() : amount
  const [whole, fraction = ''] = normalized.split('.')
  const fractionPadded = (fraction + '0'.repeat(decimals)).slice(0, decimals)

  return (
    BigInt(whole || '0') * 10n ** BigInt(decimals)
    + BigInt(fractionPadded || '0')
  )
}

function normalizePartition(values: Array<string | number | bigint>): bigint[] {
  return values.map(value => BigInt(value))
}

function createWalletCall(target: `0x${string}`, data: `0x${string}`): WalletCall {
  return {
    target,
    value: '0',
    data,
  }
}

export function getDepositWalletDeadline(now = Date.now()) {
  return Math.floor(now / 1000) + DEPOSIT_WALLET_BATCH_DEADLINE_SECONDS
}

export function buildApproveTokenCalls(): WalletCall[] {
  return [
    createWalletCall(COLLATERAL_TOKEN_ADDRESS, encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONDITIONAL_TOKENS_CONTRACT, MAX_ALLOWANCE],
    })),
    createWalletCall(COLLATERAL_TOKEN_ADDRESS, encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [CTF_EXCHANGE_ADDRESS, MAX_ALLOWANCE],
    })),
    createWalletCall(CONDITIONAL_TOKENS_CONTRACT, encodeFunctionData({
      abi: erc1155Abi,
      functionName: 'setApprovalForAll',
      args: [CTF_EXCHANGE_ADDRESS, true],
    })),
    createWalletCall(COLLATERAL_TOKEN_ADDRESS, encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [NEG_RISK_CTF_EXCHANGE_ADDRESS, MAX_ALLOWANCE],
    })),
    createWalletCall(COLLATERAL_TOKEN_ADDRESS, encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [UMA_NEG_RISK_ADAPTER_ADDRESS, MAX_ALLOWANCE],
    })),
    createWalletCall(CONDITIONAL_TOKENS_CONTRACT, encodeFunctionData({
      abi: erc1155Abi,
      functionName: 'setApprovalForAll',
      args: [NEG_RISK_CTF_EXCHANGE_ADDRESS, true],
    })),
    createWalletCall(CONDITIONAL_TOKENS_CONTRACT, encodeFunctionData({
      abi: erc1155Abi,
      functionName: 'setApprovalForAll',
      args: [UMA_NEG_RISK_ADAPTER_ADDRESS, true],
    })),
  ]
}

export function buildAutoRedeemAllowanceCalls(): WalletCall[] {
  return [
    createWalletCall(CONDITIONAL_TOKENS_CONTRACT, encodeFunctionData({
      abi: erc1155Abi,
      functionName: 'setApprovalForAll',
      args: [CTF_AUTO_REDEEM_ADDRESS, true],
    })),
  ]
}

export function buildSetReferralCalls(options: ReferralOptions): WalletCall[] {
  const builder = addressToBuilderCode(options.referrer)
  if (builder === ZERO_COLLECTION_ID) {
    return []
  }

  const affiliate = options.affiliate ?? zeroAddress
  const sharePercent = Math.max(0, Math.min(100, Math.trunc(options.affiliateSharePercent ?? 0)))
  const affiliatePercentage = affiliate === zeroAddress ? 0n : BigInt(sharePercent)
  const exchanges = options.exchanges ?? [CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS]

  return exchanges.map(exchange => createWalletCall(exchange, encodeFunctionData({
    abi: exchangeReferralAbi,
    functionName: 'setReferral',
    args: [builder, affiliate, affiliatePercentage],
  })))
}

export function buildClaimFeesCalls(options?: ClaimFeesOptions): WalletCall[] {
  const exchanges = options?.exchanges?.length
    ? options.exchanges
    : [CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS]

  return exchanges.map(exchange => createWalletCall(exchange, encodeFunctionData({
    abi: exchangeFeeAbi,
    functionName: 'claim',
    args: [],
  })))
}

export function buildSendErc20Call(params: {
  token: `0x${string}`
  to: `0x${string}`
  amount: string | number | bigint
  decimals?: number
}): WalletCall {
  const value = parseAmountToBaseUnits(params.amount, params.decimals ?? 6)

  return createWalletCall(params.token, encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [params.to, value],
  }))
}

export function buildNegRiskSplitPositionCall(args: NegRiskSplitArgs): WalletCall {
  return createWalletCall((args.contract ?? UMA_NEG_RISK_ADAPTER_ADDRESS) as `0x${string}`, encodeFunctionData({
    abi: negRiskAdapterAbi,
    functionName: 'splitPosition',
    args: [
      args.conditionId,
      BigInt(args.amount),
    ],
  }))
}

export function buildNegRiskRedeemPositionCall(args: NegRiskRedeemArgs): WalletCall {
  return createWalletCall((args.contract ?? UMA_NEG_RISK_ADAPTER_ADDRESS) as `0x${string}`, encodeFunctionData({
    abi: negRiskAdapterAbi,
    functionName: 'redeemPositions',
    args: [
      args.conditionId,
      [
        parseAmountToBaseUnits(args.yesAmount, 6),
        parseAmountToBaseUnits(args.noAmount, 6),
      ],
    ],
  }))
}

export function buildSplitPositionCall(args: ConditionalPositionArgs): WalletCall {
  return createWalletCall((args.contract ?? CONDITIONAL_TOKENS_CONTRACT) as `0x${string}`, encodeFunctionData({
    abi: conditionalTokensAbi,
    functionName: 'splitPosition',
    args: [
      (args.collateralToken ?? COLLATERAL_TOKEN_ADDRESS) as `0x${string}`,
      (args.parentCollectionId ?? ZERO_COLLECTION_ID) as `0x${string}`,
      args.conditionId,
      normalizePartition(args.partition),
      BigInt(args.amount),
    ],
  }))
}

export function buildMergePositionCall(args: ConditionalPositionArgs): WalletCall {
  return createWalletCall((args.contract ?? CONDITIONAL_TOKENS_CONTRACT) as `0x${string}`, encodeFunctionData({
    abi: conditionalTokensAbi,
    functionName: 'mergePositions',
    args: [
      (args.collateralToken ?? COLLATERAL_TOKEN_ADDRESS) as `0x${string}`,
      (args.parentCollectionId ?? ZERO_COLLECTION_ID) as `0x${string}`,
      args.conditionId,
      normalizePartition(args.partition),
      BigInt(args.amount),
    ],
  }))
}

export function buildConvertPositionsCall(args: ConvertPositionsArgs): WalletCall {
  return createWalletCall((args.contract ?? UMA_NEG_RISK_ADAPTER_ADDRESS) as `0x${string}`, encodeFunctionData({
    abi: negRiskAdapterAbi,
    functionName: 'convertPositions',
    args: [
      args.marketId,
      BigInt(args.indexSet),
      BigInt(args.amount),
    ],
  }))
}

export function buildRedeemPositionCall(args: ConditionalRedeemArgs): WalletCall {
  return createWalletCall((args.contract ?? CONDITIONAL_TOKENS_CONTRACT) as `0x${string}`, encodeFunctionData({
    abi: conditionalTokensAbi,
    functionName: 'redeemPositions',
    args: [
      (args.collateralToken ?? COLLATERAL_TOKEN_ADDRESS) as `0x${string}`,
      (args.parentCollectionId ?? ZERO_COLLECTION_ID) as `0x${string}`,
      args.conditionId,
      normalizePartition(args.indexSets),
    ],
  }))
}

export function getDepositWalletBatchTypedData(params: {
  chainId: number
  depositWallet: `0x${string}`
  calls: WalletCall[]
  nonce: string
  deadline?: number
}): DepositWalletTypedDataPayload {
  const deadline = params.deadline ?? getDepositWalletDeadline()
  const depositWalletParams: DepositWalletParams = {
    depositWallet: params.depositWallet,
    deadline: deadline.toString(),
    calls: params.calls.map(call => ({
      target: call.target,
      value: call.value,
      data: call.data,
    })),
  }

  return {
    domain: {
      ...getDepositWalletDomain(params.depositWallet),
      chainId: params.chainId,
    },
    types: DEPOSIT_WALLET_BATCH_TYPES,
    primaryType: 'Batch',
    message: {
      wallet: params.depositWallet,
      nonce: BigInt(params.nonce),
      deadline: BigInt(deadline),
      calls: params.calls.map(call => ({
        target: call.target,
        value: BigInt(call.value),
        data: call.data,
      })),
    },
    depositWalletParams,
  }
}

export function buildWalletTransactionRequestPayload(params: {
  from: string
  nonce: string
  signature: string
  typedData: DepositWalletTypedDataPayload
  metadata?: string
}): WalletTransactionRequestPayload {
  const depositWalletParams = params.typedData.depositWalletParams

  return {
    type: 'WALLET',
    from: params.from,
    to: DEPOSIT_WALLET_FACTORY_ADDRESS,
    data: '0x',
    value: '0',
    nonce: params.nonce,
    signature: params.signature,
    signatureParams: {
      depositWalletParams,
    },
    depositWalletParams,
    metadata: params.metadata,
  }
}
