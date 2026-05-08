import type { TypedDataDomain } from 'viem'
import type { SignTypedDataParameters } from 'wagmi/actions'
import type { BlockchainOrder } from '@/types'
import { wrapTypedDataSignature } from 'viem/experimental/erc7739'
import { EIP712_TYPES } from '@/lib/constants'
import { ZERO_BYTES32 } from '@/lib/contracts'
import { DEFAULT_CHAIN_ID } from '@/lib/network'

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
  const orderMessage = {
    salt: payload.salt,
    maker: payload.maker,
    signer: payload.signer,
    tokenId: payload.token_id,
    makerAmount: payload.maker_amount,
    takerAmount: payload.taker_amount,
    side: payload.side,
    signatureType: payload.signature_type,
    timestamp: payload.timestamp,
    metadata: payload.metadata,
    builder: payload.builder,
  }

  if (payload.signature_type === 3) {
    const typedDataSignTypes = {
      ...EIP712_TYPES,
      TypedDataSign: [
        { name: 'contents', type: 'Order' },
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' },
      ],
    } as const

    const verifierDomainMessage = {
      contents: orderMessage,
      name: 'DepositWallet',
      version: '1',
      chainId: BigInt(DEFAULT_CHAIN_ID),
      verifyingContract: payload.signer,
      salt: ZERO_BYTES32,
    }

    const signature = await signTypedDataAsync({
      domain,
      types: typedDataSignTypes,
      primaryType: 'TypedDataSign',
      message: verifierDomainMessage,
    })

    return wrapTypedDataSignature({
      domain,
      types: EIP712_TYPES,
      primaryType: 'Order',
      message: orderMessage,
      signature: signature as `0x${string}`,
    })
  }

  const signature = await signTypedDataAsync({
    domain,
    types: EIP712_TYPES,
    primaryType: 'Order',
    message: orderMessage,
  })

  return signature
}
