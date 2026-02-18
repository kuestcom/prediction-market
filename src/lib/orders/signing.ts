import type { TypedDataDomain } from 'viem'
import type { SignTypedDataParameters } from 'wagmi/actions'
import type { BlockchainOrder } from '@/types'
import { EIP712_TYPES } from '@/lib/constants'

type SignTypedDataFn = (args: SignTypedDataParameters) => Promise<string>

export interface SignOrderArgs {
  payload: BlockchainOrder
  domain: TypedDataDomain
  signTypedDataAsync: SignTypedDataFn
}

export async function signOrderPayload({
  payload,
  domain,
  signTypedDataAsync,
}: SignOrderArgs) {
  return await signTypedDataAsync({
    domain,
    types: EIP712_TYPES,
    primaryType: 'Order',
    message: {
      salt: payload.salt,
      maker: payload.maker,
      signer: payload.signer,
      taker: payload.taker,
      tokenId: payload.token_id,
      makerAmount: payload.maker_amount,
      takerAmount: payload.taker_amount,
      expiration: payload.expiration,
      nonce: payload.nonce,
      feeRateBps: payload.fee_rate_bps,
      side: payload.side,
      signatureType: payload.signature_type,
    },
  })
}
