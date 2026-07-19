import type { Hex } from 'viem'
import type { IdentityCapability } from '@/lib/identity/types'
import type { WalletTransactionRequestPayload } from '@/lib/wallet/transactions'
import { decodeFunctionData, erc20Abi, erc1155Abi, isAddress } from 'viem'
import {
  COLLATERAL_TOKEN_ADDRESS,
  CONDITIONAL_TOKENS_CONTRACT,
  CTF_AUTO_REDEEM_ADDRESS,
  CTF_EXCHANGE_ADDRESS,
  FEE_CLAIM_EXCHANGE_ADDRESSES,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'

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

const exchangeReferralAbi = [{
  name: 'setReferral',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'builder', type: 'bytes32' },
    { name: 'affiliate', type: 'address' },
    { name: 'affiliatePercentage', type: 'uint256' },
  ],
  outputs: [],
}] as const

const exchangeFeeAbi = [{
  name: 'claim',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [],
  outputs: [],
}] as const

type Operation = 'approve_tokens' | 'auto_redeem_approval' | 'split_position' | 'convert_positions'
  | 'merge_position' | 'redeem_positions' | 'send_tokens' | 'claim_fees'

export interface DepositWalletTransactionPolicy {
  capability: IdentityCapability
  operation: Operation
}

const POLICY_BY_OPERATION: Record<Operation, DepositWalletTransactionPolicy> = {
  approve_tokens: { operation: 'approve_tokens', capability: 'approve_tokens' },
  auto_redeem_approval: { operation: 'auto_redeem_approval', capability: 'approve_tokens' },
  split_position: { operation: 'split_position', capability: 'trade' },
  convert_positions: { operation: 'convert_positions', capability: 'trade' },
  merge_position: { operation: 'merge_position', capability: 'claim_or_redeem' },
  redeem_positions: { operation: 'redeem_positions', capability: 'claim_or_redeem' },
  send_tokens: { operation: 'send_tokens', capability: 'withdraw' },
  claim_fees: { operation: 'claim_fees', capability: 'affiliate_claim' },
}

const APPROVAL_SPENDERS = new Set([
  CONDITIONAL_TOKENS_CONTRACT,
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
].map(address => address.toLowerCase()))
const CONDITIONAL_OPERATORS = new Set([
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
].map(address => address.toLowerCase()))
const REFERRAL_EXCHANGES = new Set([
  CTF_EXCHANGE_ADDRESS,
  NEG_RISK_CTF_EXCHANGE_ADDRESS,
].map(address => address.toLowerCase()))
const FEE_EXCHANGES = new Set(FEE_CLAIM_EXCHANGE_ADDRESSES.map(address => address.toLowerCase()))

function normalizedAddress(value: unknown) {
  return typeof value === 'string' && isAddress(value) ? value.toLowerCase() : null
}

function isZeroValue(value: unknown) {
  try {
    return typeof value === 'string' && BigInt(value) === 0n
  }
  catch {
    return false
  }
}

function decodeCall(abi: readonly unknown[], data: string) {
  try {
    return decodeFunctionData({ abi: abi as never, data: data as Hex }) as {
      functionName: string
      args?: readonly unknown[]
    }
  }
  catch {
    return null
  }
}

function isWalletCall(value: unknown): value is { target: string, value: string, data: string } {
  return Boolean(value && typeof value === 'object'
    && 'target' in value && typeof value.target === 'string'
    && 'value' in value && typeof value.value === 'string'
    && 'data' in value && typeof value.data === 'string')
}

function classifyCall(call: unknown): Operation | null {
  if (!isWalletCall(call)) {
    return null
  }
  const target = normalizedAddress(call.target)
  if (!target || !isZeroValue(call.value) || !/^0x[0-9a-f]+$/i.test(call.data)) {
    return null
  }

  if (target === COLLATERAL_TOKEN_ADDRESS.toLowerCase()) {
    const decoded = decodeCall(erc20Abi, call.data)
    if (decoded?.functionName === 'transfer') {
      const amount = decoded.args?.[1]
      return typeof amount === 'bigint' && amount > 0n ? 'send_tokens' : null
    }
    if (decoded?.functionName === 'approve') {
      const spender = normalizedAddress(decoded.args?.[0])
      const amount = decoded.args?.[1]
      return spender && APPROVAL_SPENDERS.has(spender) && amount === (1n << 256n) - 1n
        ? 'approve_tokens'
        : null
    }
    return null
  }

  if (target === CONDITIONAL_TOKENS_CONTRACT.toLowerCase()) {
    const approval = decodeCall(erc1155Abi, call.data)
    if (approval?.functionName === 'setApprovalForAll') {
      const operator = normalizedAddress(approval.args?.[0])
      const approved = approval.args?.[1]
      if (!operator || approved !== true) {
        return null
      }
      if (operator === CTF_AUTO_REDEEM_ADDRESS.toLowerCase()) {
        return 'auto_redeem_approval'
      }
      return CONDITIONAL_OPERATORS.has(operator) ? 'approve_tokens' : null
    }

    const decoded = decodeCall(conditionalTokensAbi, call.data)
    if (decoded?.functionName === 'splitPosition') {
      return 'split_position'
    }
    if (decoded?.functionName === 'mergePositions') {
      return 'merge_position'
    }
    if (decoded?.functionName === 'redeemPositions') {
      return 'redeem_positions'
    }
    return null
  }

  if (target === UMA_NEG_RISK_ADAPTER_ADDRESS.toLowerCase()) {
    const conditionalCall = decodeCall(conditionalTokensAbi, call.data)
    if (conditionalCall?.functionName === 'mergePositions') {
      return 'merge_position'
    }

    const decoded = decodeCall(negRiskAdapterAbi, call.data)
    if (decoded?.functionName === 'splitPosition') {
      return 'split_position'
    }
    if (decoded?.functionName === 'convertPositions') {
      return 'convert_positions'
    }
    if (decoded?.functionName === 'redeemPositions') {
      return 'redeem_positions'
    }
    return null
  }

  if (REFERRAL_EXCHANGES.has(target)) {
    const decoded = decodeCall(exchangeReferralAbi, call.data)
    if (decoded?.functionName === 'setReferral') {
      return 'approve_tokens'
    }
  }

  if (FEE_EXCHANGES.has(target)) {
    const decoded = decodeCall(exchangeFeeAbi, call.data)
    if (decoded?.functionName === 'claim') {
      return 'claim_fees'
    }
  }

  return null
}

function sameUnsignedInteger(left: unknown, right: unknown) {
  try {
    return typeof left === 'string' && typeof right === 'string'
      && BigInt(left) >= 0n && BigInt(left) === BigInt(right)
  }
  catch {
    return false
  }
}

function haveSameCalls(
  left: unknown[],
  right: unknown[],
) {
  return left.length === right.length && left.every((call, index) => {
    const other = right[index]
    return isWalletCall(call) && isWalletCall(other)
      && normalizedAddress(call.target) === normalizedAddress(other.target)
      && sameUnsignedInteger(call.value, other.value)
      && call.data.toLowerCase() === other.data.toLowerCase()
  })
}

export function resolveDepositWalletTransactionPolicy(
  request: WalletTransactionRequestPayload,
): DepositWalletTransactionPolicy | null {
  const direct = request.depositWalletParams
  const signed = request.signatureParams?.depositWalletParams
  if (!direct || !signed
    || normalizedAddress(direct.depositWallet) !== normalizedAddress(signed.depositWallet)
    || !sameUnsignedInteger(direct.deadline, signed.deadline)
    || !Array.isArray(direct.calls) || !Array.isArray(signed.calls)
    || direct.calls.length === 0
    || !haveSameCalls(direct.calls, signed.calls)) {
    return null
  }

  const operations = direct.calls.map(classifyCall)
  const operation = operations[0]
  if (!operation || operations.some(candidate => candidate !== operation) || request.metadata !== operation) {
    return null
  }

  return POLICY_BY_OPERATION[operation]
}
