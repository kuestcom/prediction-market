import type { Address, Hex, TypedDataDomain } from 'viem'
import {
  concatHex,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  erc1155Abi,
  size,
  zeroAddress,
} from 'viem'
import {
  COLLATERAL_TOKEN_ADDRESS,
  CONDITIONAL_TOKENS_CONTRACT,
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  SAFE_MULTISEND_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
  ZERO_COLLECTION_ID,
} from '@/lib/contracts'

export enum SafeOperationType {
  Call = 0,
  DelegateCall = 1,
}

export interface SafeTransaction {
  to: `0x${string}`
  value: string
  data: `0x${string}`
  operation: SafeOperationType
}

const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

const MAX_ALLOWANCE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

const multisendAbi = [
  {
    name: 'multiSend',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'transactions', type: 'bytes' }],
    outputs: [],
  },
] as const

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
      { name: 'referrer', type: 'address' },
      { name: 'affiliate', type: 'address' },
      { name: 'affiliatePercentage', type: 'uint256' },
    ],
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

interface SafeTxMessage {
  to: `0x${string}`
  value: bigint
  data: `0x${string}`
  operation: number
  safeTxGas: bigint
  baseGas: bigint
  gasPrice: bigint
  gasToken: `0x${string}`
  refundReceiver: `0x${string}`
  nonce: bigint
}

interface SafeTypedDataPayload {
  domain: TypedDataDomain
  types: typeof SAFE_TX_TYPES
  primaryType: 'SafeTx'
  message: SafeTxMessage
  signatureParams: {
    gasPrice: string
    operation: string
    safeTxnGas: string
    baseGas: string
    gasToken: string
    refundReceiver: string
  }
}

export interface SafeTransactionRequestPayload {
  type: 'SAFE'
  from: string
  to: string
  proxyWallet: string
  data: string
  nonce: string
  signature: string
  signatureParams: SafeTypedDataPayload['signatureParams']
  metadata?: string
}

interface ApproveOptions {
  spenders?: `0x${string}`[]
  operators?: `0x${string}`[]
}

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

export function buildApproveTokenTransactions(options?: ApproveOptions): SafeTransaction[] {
  const spenderList = options?.spenders?.length
    ? options.spenders
    : [CONDITIONAL_TOKENS_CONTRACT, UMA_NEG_RISK_ADAPTER_ADDRESS]

  const uniqueSpenders = Array.from(new Set(spenderList)) as `0x${string}`[]
  const operators = options?.operators?.length
    ? options.operators
    : [CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS, UMA_NEG_RISK_ADAPTER_ADDRESS]

  const transactions: SafeTransaction[] = uniqueSpenders.map(spender => ({
    to: COLLATERAL_TOKEN_ADDRESS as `0x${string}`,
    value: '0',
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, MAX_ALLOWANCE],
    }),
    operation: SafeOperationType.Call,
  }))

  for (const operator of operators) {
    transactions.push({
      to: CONDITIONAL_TOKENS_CONTRACT as `0x${string}`,
      value: '0',
      data: encodeFunctionData({
        abi: erc1155Abi,
        functionName: 'setApprovalForAll',
        args: [operator, true],
      }),
      operation: SafeOperationType.Call,
    })
  }

  return transactions
}

interface ReferralOptions {
  referrer: `0x${string}`
  affiliate?: `0x${string}`
  affiliateSharePercent?: number
  exchanges?: `0x${string}`[]
}

export function buildSetReferralTransactions(options: ReferralOptions): SafeTransaction[] {
  const referrer = options.referrer
  if (!referrer || referrer === zeroAddress) {
    return []
  }

  const affiliate = options.affiliate ?? zeroAddress
  const sharePercent = Math.max(0, Math.min(100, Math.trunc(options.affiliateSharePercent ?? 0)))
  const affiliatePercentage = affiliate === zeroAddress ? 0n : BigInt(sharePercent)
  // Empty array means "skip referral writes" (e.g., already locked).
  const exchanges = options.exchanges ?? [CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS]

  return exchanges.map(exchange => ({
    to: exchange,
    value: '0',
    data: encodeFunctionData({
      abi: exchangeReferralAbi,
      functionName: 'setReferral',
      args: [referrer, affiliate, affiliatePercentage],
    }),
    operation: SafeOperationType.Call,
  }))
}

export function buildSendErc20Transaction(params: {
  token: `0x${string}`
  to: `0x${string}`
  amount: string | number | bigint
  decimals?: number
}): SafeTransaction {
  const value = parseAmountToBaseUnits(params.amount, params.decimals ?? 6)

  return {
    to: params.token,
    value: '0',
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [params.to, value],
    }),
    operation: SafeOperationType.Call,
  }
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

function normalizePartition(values: Array<string | number | bigint>): bigint[] {
  return values.map(value => BigInt(value))
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

export function buildNegRiskSplitPositionTransaction(args: NegRiskSplitArgs): SafeTransaction {
  const data = encodeFunctionData({
    abi: negRiskAdapterAbi,
    functionName: 'splitPosition',
    args: [
      args.conditionId,
      BigInt(args.amount),
    ],
  })

  return {
    to: (args.contract ?? UMA_NEG_RISK_ADAPTER_ADDRESS) as `0x${string}`,
    value: '0',
    data,
    operation: SafeOperationType.Call,
  }
}

export function buildNegRiskRedeemPositionTransaction(args: NegRiskRedeemArgs): SafeTransaction {
  const data = encodeFunctionData({
    abi: negRiskAdapterAbi,
    functionName: 'redeemPositions',
    args: [
      args.conditionId,
      [
        parseAmountToBaseUnits(args.yesAmount, 6),
        parseAmountToBaseUnits(args.noAmount, 6),
      ],
    ],
  })

  return {
    to: (args.contract ?? UMA_NEG_RISK_ADAPTER_ADDRESS) as `0x${string}`,
    value: '0',
    data,
    operation: SafeOperationType.Call,
  }
}

export function buildSplitPositionTransaction(args: ConditionalPositionArgs): SafeTransaction {
  const data = encodeFunctionData({
    abi: conditionalTokensAbi,
    functionName: 'splitPosition',
    args: [
      (args.collateralToken ?? COLLATERAL_TOKEN_ADDRESS) as `0x${string}`,
      (args.parentCollectionId ?? ZERO_COLLECTION_ID) as `0x${string}`,
      args.conditionId,
      normalizePartition(args.partition),
      BigInt(args.amount),
    ],
  })

  return {
    to: (args.contract ?? CONDITIONAL_TOKENS_CONTRACT) as `0x${string}`,
    value: '0',
    data,
    operation: SafeOperationType.Call,
  }
}

export function buildMergePositionTransaction(args: ConditionalPositionArgs): SafeTransaction {
  const data = encodeFunctionData({
    abi: conditionalTokensAbi,
    functionName: 'mergePositions',
    args: [
      (args.collateralToken ?? COLLATERAL_TOKEN_ADDRESS) as `0x${string}`,
      (args.parentCollectionId ?? ZERO_COLLECTION_ID) as `0x${string}`,
      args.conditionId,
      normalizePartition(args.partition),
      BigInt(args.amount),
    ],
  })

  return {
    to: (args.contract ?? CONDITIONAL_TOKENS_CONTRACT) as `0x${string}`,
    value: '0',
    data,
    operation: SafeOperationType.Call,
  }
}

export function buildConvertPositionsTransaction(args: ConvertPositionsArgs): SafeTransaction {
  const data = encodeFunctionData({
    abi: negRiskAdapterAbi,
    functionName: 'convertPositions',
    args: [
      args.marketId,
      BigInt(args.indexSet),
      BigInt(args.amount),
    ],
  })

  return {
    to: (args.contract ?? UMA_NEG_RISK_ADAPTER_ADDRESS) as `0x${string}`,
    value: '0',
    data,
    operation: SafeOperationType.Call,
  }
}

export function buildRedeemPositionTransaction(args: ConditionalRedeemArgs): SafeTransaction {
  const data = encodeFunctionData({
    abi: conditionalTokensAbi,
    functionName: 'redeemPositions',
    args: [
      (args.collateralToken ?? COLLATERAL_TOKEN_ADDRESS) as `0x${string}`,
      (args.parentCollectionId ?? ZERO_COLLECTION_ID) as `0x${string}`,
      args.conditionId,
      normalizePartition(args.indexSets),
    ],
  })

  return {
    to: (args.contract ?? CONDITIONAL_TOKENS_CONTRACT) as `0x${string}`,
    value: '0',
    data,
    operation: SafeOperationType.Call,
  }
}

export function aggregateSafeTransactions(transactions: SafeTransaction[]): SafeTransaction {
  if (transactions.length === 1) {
    return transactions[0]
  }

  const encoded = concatHex(
    transactions.map(tx =>
      encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [
          tx.operation,
          tx.to,
          BigInt(tx.value),
          BigInt(size(tx.data as Hex)),
          tx.data,
        ],
      ),
    ),
  )

  const data = encodeFunctionData({
    abi: multisendAbi,
    functionName: 'multiSend',
    args: [encoded],
  })

  return {
    to: SAFE_MULTISEND_ADDRESS,
    value: '0',
    data,
    operation: SafeOperationType.DelegateCall,
  }
}

export function getSafeTxTypedData(params: {
  chainId: number
  safeAddress: `0x${string}`
  transaction: SafeTransaction
  nonce: string
}): SafeTypedDataPayload {
  const signatureParams = {
    gasPrice: '0',
    operation: `${params.transaction.operation}`,
    safeTxnGas: '0',
    baseGas: '0',
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
  }

  const message: SafeTxMessage = {
    to: params.transaction.to as Address,
    value: BigInt(params.transaction.value),
    data: params.transaction.data as Hex,
    operation: params.transaction.operation,
    safeTxGas: BigInt(signatureParams.safeTxnGas),
    baseGas: BigInt(signatureParams.baseGas),
    gasPrice: BigInt(signatureParams.gasPrice),
    gasToken: signatureParams.gasToken as Address,
    refundReceiver: signatureParams.refundReceiver as Address,
    nonce: BigInt(params.nonce),
  }

  const domain: TypedDataDomain = {
    chainId: params.chainId,
    verifyingContract: params.safeAddress,
  }

  return {
    domain,
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message,
    signatureParams,
  }
}

export function packSafeSignature(signature: `0x${string}`): string {
  let sigV = Number.parseInt(signature.slice(-2), 16)
  switch (sigV) {
    case 0:
    case 1:
      sigV += 31
      break
    case 27:
    case 28:
      sigV += 4
      break
    default:
      throw new Error('Invalid signature')
  }

  const adjusted = signature.slice(0, -2) + sigV.toString(16).padStart(2, '0')
  const r = BigInt(`0x${adjusted.slice(2, 66)}`)
  const s = BigInt(`0x${adjusted.slice(66, 130)}`)
  const v = BigInt(`0x${adjusted.slice(130, 132)}`)

  return encodePacked(['uint256', 'uint256', 'uint8'], [r, s, Number(v)])
}
