import type { CLOB_ORDER_TYPE } from '@/lib/constants'
import type { BlockchainOrder, OrderSide, OrderType, Outcome } from '@/types'
import { storeOrderAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/store-order'
import { MICRO_UNIT, ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { ZERO_ADDRESS, ZERO_BYTES32 } from '@/lib/contracts'
import { toMicro } from '@/lib/formatters'

export interface CalculateOrderAmountsArgs {
  orderType: OrderType
  side: OrderSide
  amount: string
  limitPrice: string
  limitShares: string
  marketPriceCents?: number
}

export interface BuildOrderPayloadArgs extends CalculateOrderAmountsArgs {
  userAddress: `0x${string}`
  outcome: Outcome
  makerAddress?: `0x${string}`
  signatureType?: number
  expirationTimestamp?: number
  metadata?: `0x${string}`
  builder?: `0x${string}`
}

export interface SubmitOrderArgs {
  order: BlockchainOrder
  signature: string
  orderType: OrderType
  clobOrderType?: keyof typeof CLOB_ORDER_TYPE
  conditionId: string
  slug: string
}

const DEFAULT_ORDER_FIELDS = {
  salt: 0n,
  expiration: 0n,
  nonce: 0n,
  fee_rate_bps: 0n,
  signature_type: 0,
  metadata: ZERO_BYTES32,
  builder: ZERO_BYTES32,
} as const

function generateOrderSalt() {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined

  if (cryptoObj?.getRandomValues) {
    const buffer = new Uint32Array(2)
    cryptoObj.getRandomValues(buffer)

    let value = 0n
    buffer.forEach((segment) => {
      value = (value << 32n) + BigInt(segment)
    })

    if (value > 0n) {
      return value
    }
  }

  const fallback = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  return BigInt(fallback || Date.now())
}

export function calculateOrderAmounts({
  orderType,
  side,
  amount,
  limitPrice,
  limitShares,
  marketPriceCents,
}: CalculateOrderAmountsArgs) {
  let makerAmount: bigint
  let takerAmount: bigint
  const normalizedMarketPrice = Number.isFinite(marketPriceCents) && (marketPriceCents ?? 0) > 0
    ? (Number(marketPriceCents) / 100)
    : 1

  if (orderType === ORDER_TYPE.LIMIT) {
    const normalizedLimitPrice = (Number.parseFloat(limitPrice) || 0) / 100
    const priceMicro = BigInt(toMicro(normalizedLimitPrice))
    const sharesMicro = BigInt(toMicro(limitShares))

    if (side === ORDER_SIDE.BUY) {
      makerAmount = (priceMicro * sharesMicro) / BigInt(MICRO_UNIT)
      takerAmount = sharesMicro
    }
    else {
      makerAmount = sharesMicro
      takerAmount = (priceMicro * sharesMicro) / BigInt(MICRO_UNIT)
    }
  }
  else {
    makerAmount = BigInt(toMicro(amount))
    if (side === ORDER_SIDE.BUY) {
      const priceMicro = BigInt(toMicro(normalizedMarketPrice))
      takerAmount = priceMicro > 0n ? (makerAmount * BigInt(MICRO_UNIT)) / priceMicro : makerAmount
    }
    else {
      const priceMicro = BigInt(toMicro(normalizedMarketPrice))
      takerAmount = priceMicro > 0n ? (priceMicro * makerAmount) / BigInt(MICRO_UNIT) : makerAmount
    }
  }

  return { makerAmount, takerAmount }
}

export function buildOrderPayload({
  userAddress,
  outcome,
  makerAddress,
  signatureType,
  expirationTimestamp,
  metadata,
  builder,
  ...rest
}: BuildOrderPayloadArgs): BlockchainOrder {
  const { makerAmount, takerAmount } = calculateOrderAmounts(rest)
  const salt = generateOrderSalt()
  const maker = makerAddress ?? userAddress
  const signatureTypeValue = typeof signatureType === 'number' ? signatureType : DEFAULT_ORDER_FIELDS.signature_type
  const expirationValue = typeof expirationTimestamp === 'number' && Number.isFinite(expirationTimestamp)
    ? BigInt(Math.max(0, Math.trunc(expirationTimestamp)))
    : DEFAULT_ORDER_FIELDS.expiration

  return {
    ...DEFAULT_ORDER_FIELDS,
    salt,
    maker,
    signer: userAddress,
    taker: ZERO_ADDRESS,
    token_id: BigInt(outcome.token_id),
    maker_amount: makerAmount,
    taker_amount: takerAmount,
    expiration: expirationValue,
    side: rest.side,
    fee_rate_bps: DEFAULT_ORDER_FIELDS.fee_rate_bps,
    signature_type: signatureTypeValue,
    timestamp: BigInt(Date.now()),
    metadata: metadata ?? DEFAULT_ORDER_FIELDS.metadata,
    builder: builder ?? DEFAULT_ORDER_FIELDS.builder,
  }
}

function serializeOrder(order: BlockchainOrder) {
  return {
    ...order,
    salt: order.salt.toString(),
    token_id: order.token_id.toString(),
    maker_amount: order.maker_amount.toString(),
    taker_amount: order.taker_amount.toString(),
    expiration: order.expiration.toString(),
    nonce: order.nonce.toString(),
    fee_rate_bps: order.fee_rate_bps.toString(),
    timestamp: order.timestamp.toString(),
    metadata: order.metadata,
    builder: order.builder,
  }
}

export async function submitOrder({
  order,
  signature,
  orderType,
  clobOrderType,
  conditionId,
  slug,
}: SubmitOrderArgs) {
  return storeOrderAction({
    ...serializeOrder(order),
    side: order.side as OrderSide,
    signature,
    type: orderType,
    clob_type: clobOrderType,
    condition_id: conditionId,
    slug,
  })
}
