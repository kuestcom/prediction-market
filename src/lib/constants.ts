import { defaultNetwork } from '@/lib/appkit'
import { CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS } from '@/lib/contracts'

export const DEFAULT_ERROR_MESSAGE = 'Internal server error. Try again in a few moments.'
export const IS_BROWSER = typeof window !== 'undefined'

export const DEFAULT_CONDITION_PARTITION = ['1', '2'] as const

export const ORDER_SIDE = {
  BUY: 0,
  SELL: 1,
} as const

export const ORDER_TYPE = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
} as const

export const CLOB_ORDER_TYPE = {
  FOK: 'FOK',
  FAK: 'FAK',
  GTC: 'GTC',
  GTD: 'GTD',
} as const

export const OUTCOME_INDEX = {
  YES: 0,
  NO: 1,
} as const

export const MICRO_UNIT = 1_000_000

export const EIP712_DOMAIN = {
  name: 'CTF Exchange',
  version: '1',
  chainId: defaultNetwork.id,
  verifyingContract: CTF_EXCHANGE_ADDRESS,
} as const

export const NEG_RISK_EIP712_DOMAIN = {
  name: 'CTF Exchange',
  version: '1',
  chainId: defaultNetwork.id,
  verifyingContract: NEG_RISK_CTF_EXCHANGE_ADDRESS,
} as const

export const EIP712_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
}

export function getExchangeEip712Domain(isNegRisk?: boolean) {
  return isNegRisk ? NEG_RISK_EIP712_DOMAIN : EIP712_DOMAIN
}

export const tableHeaderClass = 'px-2 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-3'
