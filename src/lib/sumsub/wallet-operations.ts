import type { WalletTransactionRequestPayload } from '@/lib/wallet/transactions'

const EXIT_OPERATION_SELECTORS = {
  send_tokens: ['0xa9059cbb'],
  claim_fees: ['0x4e71d92d'],
  redeem_positions: ['0x01b7037c', '0xdbeccb23'],
  merge_position: ['0x9e7212ad'],
} as const

type ExitOperation = keyof typeof EXIT_OPERATION_SELECTORS

export function isSumsubExitOperation(metadata: string | undefined): metadata is ExitOperation {
  return Boolean(metadata && Object.hasOwn(EXIT_OPERATION_SELECTORS, metadata))
}

export function isVerifiedSumsubExitTransaction(request: WalletTransactionRequestPayload) {
  if (!isSumsubExitOperation(request.metadata)) {
    return false
  }

  const calls = request.depositWalletParams?.calls
  if (!calls?.length) {
    return false
  }

  const allowedSelectors = EXIT_OPERATION_SELECTORS[request.metadata]
  return calls.every((call) => {
    const data = call.data.toLowerCase()
    return call.value === '0' && allowedSelectors.some(selector => data.startsWith(selector))
  })
}
