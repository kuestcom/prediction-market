import type { AbiParameter, Hex } from 'viem'

import { decodeAbiParameters, encodeAbiParameters } from 'viem'

import type { WalletTransactionRequestPayload } from '@/lib/wallet/transactions'

import {
  COLLATERAL_TOKEN_ADDRESS,
  CONDITIONAL_TOKENS_CONTRACT,
  FEE_CLAIM_EXCHANGE_ADDRESSES,
  RESOLUTION_REWARDS_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'

const EXIT_OPERATION_SELECTORS = {
  send_tokens: ['0xa9059cbb'],
  claim_fees: ['0x4e71d92d'],
  redeem_positions: ['0x01b7037c', '0xdbeccb23'],
  merge_position: ['0x9e7212ad'],
  claim_resolution_rewards: ['0x1e83409a'],
  request_resolution_reward_withdrawal: ['0x9ee679e8'],
  release_resolution_reward_bond: ['0xcc532f2c'],
} as const

type ExitOperation = keyof typeof EXIT_OPERATION_SELECTORS

const TRANSFER_PARAMETERS = [
  { name: 'to', type: 'address' },
  { name: 'amount', type: 'uint256' },
] as const satisfies readonly AbiParameter[]
const CONDITIONAL_POSITION_PARAMETERS = [
  { name: 'collateralToken', type: 'address' },
  { name: 'parentCollectionId', type: 'bytes32' },
  { name: 'conditionId', type: 'bytes32' },
  { name: 'partition', type: 'uint256[]' },
  { name: 'amount', type: 'uint256' },
] as const satisfies readonly AbiParameter[]
const CONDITIONAL_REDEEM_PARAMETERS = [
  { name: 'collateralToken', type: 'address' },
  { name: 'parentCollectionId', type: 'bytes32' },
  { name: 'conditionId', type: 'bytes32' },
  { name: 'indexSets', type: 'uint256[]' },
] as const satisfies readonly AbiParameter[]
const NEG_RISK_REDEEM_PARAMETERS = [
  { name: 'conditionId', type: 'bytes32' },
  { name: 'amounts', type: 'uint256[]' },
] as const satisfies readonly AbiParameter[]
const RESOLUTION_REWARDS_CLAIM_PARAMETERS = [
  { name: 'token', type: 'address' },
] as const satisfies readonly AbiParameter[]
const RESOLUTION_REWARDS_PROPOSAL_PARAMETERS = [
  { name: 'proposalId', type: 'uint256' },
] as const satisfies readonly AbiParameter[]

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase()
}

function hasCanonicalArguments(data: string, selector: string, parameters: readonly AbiParameter[]) {
  if (!data.toLowerCase().startsWith(selector)) {
    return false
  }
  try {
    const encodedArguments = `0x${data.slice(selector.length)}` as Hex
    const decoded = decodeAbiParameters(parameters, encodedArguments)
    return `${selector}${encodeAbiParameters(parameters, decoded).slice(2)}`.toLowerCase() === data.toLowerCase()
  } catch {
    return false
  }
}

function hasMatchingSignedParams(request: WalletTransactionRequestPayload) {
  const direct = request.depositWalletParams
  const signed = request.signatureParams?.depositWalletParams
  if (
    !direct ||
    !signed ||
    !direct.calls?.length ||
    !signed.calls?.length ||
    !sameAddress(direct.depositWallet, signed.depositWallet) ||
    direct.deadline !== signed.deadline ||
    direct.calls.length !== signed.calls.length
  ) {
    return false
  }
  return direct.calls.every((call, index) => {
    const signedCall = signed.calls[index]
    return Boolean(
      signedCall &&
      sameAddress(call.target, signedCall.target) &&
      call.value === signedCall.value &&
      call.data.toLowerCase() === signedCall.data.toLowerCase(),
    )
  })
}

function isAllowedExitCall(operation: ExitOperation, call: { target: string; value: string; data: string }) {
  if (call.value !== '0') {
    return false
  }

  if (operation === 'send_tokens') {
    return (
      sameAddress(call.target, COLLATERAL_TOKEN_ADDRESS) &&
      hasCanonicalArguments(call.data, EXIT_OPERATION_SELECTORS.send_tokens[0], TRANSFER_PARAMETERS)
    )
  }
  if (operation === 'claim_fees') {
    return (
      FEE_CLAIM_EXCHANGE_ADDRESSES.some((target) => sameAddress(call.target, target)) &&
      call.data.toLowerCase() === EXIT_OPERATION_SELECTORS.claim_fees[0]
    )
  }
  if (operation === 'claim_resolution_rewards') {
    if (!sameAddress(call.target, RESOLUTION_REWARDS_ADDRESS)) {
      return false
    }
    if (
      !hasCanonicalArguments(
        call.data,
        EXIT_OPERATION_SELECTORS.claim_resolution_rewards[0],
        RESOLUTION_REWARDS_CLAIM_PARAMETERS,
      )
    ) {
      return false
    }
    const [token] = decodeAbiParameters(
      RESOLUTION_REWARDS_CLAIM_PARAMETERS,
      `0x${call.data.slice(EXIT_OPERATION_SELECTORS.claim_resolution_rewards[0].length)}` as Hex,
    )
    return sameAddress(token, COLLATERAL_TOKEN_ADDRESS)
  }
  if (operation === 'request_resolution_reward_withdrawal' || operation === 'release_resolution_reward_bond') {
    return (
      sameAddress(call.target, RESOLUTION_REWARDS_ADDRESS) &&
      hasCanonicalArguments(call.data, EXIT_OPERATION_SELECTORS[operation][0], RESOLUTION_REWARDS_PROPOSAL_PARAMETERS)
    )
  }

  const isConditionalTokens = sameAddress(call.target, CONDITIONAL_TOKENS_CONTRACT)
  const isNegRiskAdapter = sameAddress(call.target, UMA_NEG_RISK_ADAPTER_ADDRESS)
  if (!isConditionalTokens && !isNegRiskAdapter) {
    return false
  }
  if (operation === 'merge_position') {
    return hasCanonicalArguments(call.data, EXIT_OPERATION_SELECTORS.merge_position[0], CONDITIONAL_POSITION_PARAMETERS)
  }
  return isConditionalTokens
    ? hasCanonicalArguments(call.data, EXIT_OPERATION_SELECTORS.redeem_positions[0], CONDITIONAL_REDEEM_PARAMETERS)
    : hasCanonicalArguments(call.data, EXIT_OPERATION_SELECTORS.redeem_positions[1], NEG_RISK_REDEEM_PARAMETERS)
}

export function isSumsubExitOperation(metadata: string | undefined): metadata is ExitOperation {
  return Boolean(metadata && Object.hasOwn(EXIT_OPERATION_SELECTORS, metadata))
}

export function isVerifiedSumsubExitTransaction(request: WalletTransactionRequestPayload) {
  const operation = request.metadata
  if (!isSumsubExitOperation(operation) || !hasMatchingSignedParams(request)) {
    return false
  }

  const calls = request.depositWalletParams?.calls
  if (!calls?.length) {
    return false
  }
  return calls.every((call) => isAllowedExitCall(operation, call))
}
