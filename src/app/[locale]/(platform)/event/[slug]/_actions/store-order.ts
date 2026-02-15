'use server'

import { updateTag } from 'next/cache'
import { createPublicClient, erc1155Abi, http } from 'viem'
import { z } from 'zod'
import { defaultNetwork } from '@/lib/appkit'
import { cacheTags } from '@/lib/cache-tags'
import { CLOB_ORDER_TYPE, ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { CONDITIONAL_TOKENS_CONTRACT } from '@/lib/contracts'
import { OrderRepository } from '@/lib/db/queries/order'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'
import { normalizeAddress } from '@/lib/wallet'

const StoreOrderSchema = z.object({
  // begin blockchain data
  salt: z.string(),
  maker: z.string(),
  signer: z.string(),
  taker: z.string(),
  token_id: z.string(),
  maker_amount: z.string(),
  taker_amount: z.string(),
  expiration: z.string(),
  nonce: z.string(),
  fee_rate_bps: z.string(),
  side: z.union([z.literal(0), z.literal(1)]),
  signature_type: z.number(),
  signature: z.string(),
  // end blockchain data

  type: z.union([z.literal(ORDER_TYPE.MARKET), z.literal(ORDER_TYPE.LIMIT)]),
  clob_type: z.enum(CLOB_ORDER_TYPE).optional(),
  condition_id: z.string(),
  slug: z.string(),
})

type StoreOrderInput = z.infer<typeof StoreOrderSchema>

const DEFAULT_ERROR_MESSAGE = 'Something went wrong while processing your order. Please try again.'
const CLOB_REQUEST_TIMEOUT_MS = 20_000
const RPC_TRANSPORT = http(defaultNetwork.rpcUrls.default.http[0])
const CLOB_ERROR_MESSAGES: Record<string, string> = {
  'condition_paused': 'Trading is paused for this market.',
  'system_paused': 'Trading is temporarily paused. Please try again shortly.',
  'owner_address_mismatch': 'Your trading session is out of sync. Reconnect and try again.',
  'invalid_l2': 'Your trading session expired. Please sign in again.',
  'user_banned': 'Your account is not allowed to trade right now.',
  'internal_error': 'Trading is temporarily unavailable. Please try again shortly.',
  'invalid order signature': 'Your order signature could not be verified. Please sign and try again.',
  'order expired': 'This order expired. Refresh prices and submit again.',
  'invalid expiration': 'This order expiration is invalid. Please refresh and try again.',
  'order is invalid. duplicated. same order has already been placed, can\'t be placed again': 'This exact order was already submitted.',
  'order couldn\'t be fully filled, fok orders are fully filled/killed': 'Not enough liquidity to fully fill this order right now.',
  'the market is not yet ready to process new orders': 'This market is temporarily unavailable for trading. Please try again shortly.',
  'order is invalid. size lower than the minimum': 'Order size is too small for this market.',
  'order is invalid. price breaks minimum tick size rules': 'Order price is invalid for this market.',
  'not enough balance / allowance': 'Insufficient available balance for this order.',
  'on-chain precheck failed': 'We could not validate this order on-chain. Please try again.',
  'on-chain settlement failed': 'This order could not be settled right now. Please try again.',
  'could not insert order': 'Could not submit your order right now. Please try again.',
  'could not run the execution': 'Could not execute your order right now. Please try again.',
  'error delaying the order': 'Order processing is delayed right now. Please try again.',
  'order match delayed due to market conditions': 'Order matching is delayed due to market conditions.',
}

const CLOB_ERROR_PATTERNS: Array<{ pattern: RegExp, message: string }> = [
  {
    pattern: /\b(not enough (unlocked )?balance|insufficient unlocked (position|collateral)|insufficient unlocked)\b/i,
    message: 'Insufficient available balance for this order.',
  },
  {
    pattern: /\b(order .* expired|expiration must be in the future|expiration must be non-negative|expiration is required)\b/i,
    message: 'This order expiration is invalid. Refresh prices and try again.',
  },
  {
    pattern: /\b(tokenid is required|conditionid is required|tokenid not found for conditionid lookup|maker is required|signer is required|taker is required)\b/i,
    message: 'Market data is out of date. Please refresh and try again.',
  },
  {
    pattern: /\b(postonly requires gtc or gtd)\b/i,
    message: 'Post-only is only available for limit orders.',
  },
  {
    pattern: /\b(postonly would cross the best (ask|bid))\b/i,
    message: 'Post-only orders must not execute immediately. Adjust the price and try again.',
  },
  {
    pattern: /\b(orderbook not ready|market is not yet ready|unable to derive price for postonly|unable to derive price for order)\b/i,
    message: 'This market is temporarily unavailable for trading. Please try again shortly.',
  },
  {
    pattern: /\b(failed to verify signature|invalid signature for order)\b/i,
    message: 'Your order signature could not be verified. Please sign and try again.',
  },
  {
    pattern: /\b(failed to check balances|makeramount must be positive|order quantity must be positive|makeramount and takeramount must be positive)\b/i,
    message: 'Order size is invalid for this market.',
  },
  {
    pattern: /\b(unsupported verifying contract|feeratebps must be >= exchangebasefeerate|feeratebps must be non-negative)\b/i,
    message: 'Trading settings are out of date. Refresh and try again.',
  },
  {
    pattern: /\b(transaction reverted|transport error|condition worker dropped response)\b/i,
    message: 'Order execution failed. Please try again shortly.',
  },
]

let conditionalTokensClient: ReturnType<typeof createPublicClient> | null = null

function getConditionalTokensClient() {
  if (!conditionalTokensClient) {
    conditionalTokensClient = createPublicClient({
      chain: defaultNetwork,
      transport: RPC_TRANSPORT,
    })
  }
  return conditionalTokensClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringField(payload: Record<string, unknown> | null, key: string) {
  if (!payload) {
    return null
  }
  const value = payload[key]
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapClobErrorMessage(rawError: string | null) {
  if (!rawError) {
    return DEFAULT_ERROR_MESSAGE
  }
  const normalized = rawError.trim()
  if (!normalized) {
    return DEFAULT_ERROR_MESSAGE
  }

  const lower = normalized.toLowerCase()
  const mapped = CLOB_ERROR_MESSAGES[lower]
  if (mapped) {
    return mapped
  }

  for (const { pattern, message } of CLOB_ERROR_PATTERNS) {
    if (pattern.test(lower)) {
      return message
    }
  }

  console.error('Unmapped CLOB error message.', normalized)
  return DEFAULT_ERROR_MESSAGE
}

async function readClobResponsePayload(response: {
  text?: () => Promise<string>
  json?: () => Promise<unknown>
}) {
  let responseText = ''
  let payload: Record<string, unknown> | null = null

  if (typeof response.text === 'function') {
    responseText = await response.text()
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText) as unknown
        if (isRecord(parsed)) {
          payload = parsed
        }
      }
      catch (error) {
        console.error('Failed to parse CLOB response payload.', error)
      }
    }
    return { responseText, payload }
  }

  if (typeof response.json === 'function') {
    try {
      const parsed = await response.json()
      if (isRecord(parsed)) {
        payload = parsed
        responseText = JSON.stringify(parsed)
      }
    }
    catch (error) {
      console.error('Failed to parse CLOB response payload.', error)
    }
  }

  return { responseText, payload }
}

async function ensureSufficientSellShares(maker: string, tokenId: string, makerAmount: string) {
  const normalizedMaker = normalizeAddress(maker)
  if (!normalizedMaker) {
    return { ok: false, error: 'Invalid maker address.' }
  }

  try {
    const balance = await getConditionalTokensClient().readContract({
      address: CONDITIONAL_TOKENS_CONTRACT,
      abi: erc1155Abi,
      functionName: 'balanceOf',
      args: [normalizedMaker, BigInt(tokenId)],
    }) as bigint

    if (balance < BigInt(makerAmount)) {
      return {
        ok: false,
        error: 'Insufficient shares available. Reduce the sell amount or split more shares.',
      }
    }

    return { ok: true }
  }
  catch (error) {
    console.error('Failed to verify conditional token balance.', error)
    return { ok: false, error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function storeOrderAction(payload: StoreOrderInput) {
  const user = await UserRepository.getCurrentUser()
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet before trading.' }
  }

  const validated = StoreOrderSchema.safeParse(payload)

  if (!validated.success) {
    return {
      error: validated.error.issues[0].message,
    }
  }

  const defaultMarketOrderType = user.settings?.trading?.market_order_type ?? CLOB_ORDER_TYPE.FAK
  const clobOrderType = validated.data.clob_type
    ?? (validated.data.type === ORDER_TYPE.MARKET
      ? defaultMarketOrderType
      : CLOB_ORDER_TYPE.GTC)

  try {
    if (validated.data.side === ORDER_SIDE.SELL) {
      const shareCheck = await ensureSufficientSellShares(
        validated.data.maker,
        validated.data.token_id,
        validated.data.maker_amount,
      )

      if (!shareCheck.ok) {
        return { error: shareCheck.error }
      }
    }

    const expectedMaker = user.proxy_wallet_address.toLowerCase()
    if (validated.data.maker.toLowerCase() !== expectedMaker) {
      return { error: 'Invalid maker address for this order.' }
    }

    const clobPayload = {
      order: {
        salt: validated.data.salt,
        maker: validated.data.maker,
        signer: validated.data.signer,
        taker: validated.data.taker,
        conditionId: validated.data.condition_id,
        tokenId: validated.data.token_id,
        makerAmount: validated.data.maker_amount,
        takerAmount: validated.data.taker_amount,
        expiration: validated.data.expiration,
        nonce: validated.data.nonce,
        feeRateBps: validated.data.fee_rate_bps,
        side: validated.data.side === 0 ? 'BUY' : 'SELL',
        signatureType: validated.data.signature_type,
        signature: validated.data.signature,
      },
      orderType: clobOrderType,
      owner: auth.clob.key,
    }

    const method = 'POST'
    const path = '/order'
    const body = JSON.stringify(clobPayload)
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = buildClobHmacSignature(
      auth.clob.secret,
      timestamp,
      method,
      path,
      body,
    )

    const clobStoreOrderResponse = await fetch(`${process.env.CLOB_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'KUEST_ADDRESS': user.address,
        'KUEST_API_KEY': auth.clob.key,
        'KUEST_PASSPHRASE': auth.clob.passphrase,
        'KUEST_TIMESTAMP': timestamp.toString(),
        'KUEST_SIGNATURE': signature,
      },
      body,
      signal: AbortSignal.timeout(CLOB_REQUEST_TIMEOUT_MS),
    })

    const { responseText, payload: clobStoreOrderResponseJson } = await readClobResponsePayload(clobStoreOrderResponse)

    if (!clobStoreOrderResponse.ok) {
      const responseError = getStringField(clobStoreOrderResponseJson, 'error')
        ?? getStringField(clobStoreOrderResponseJson, 'errorMsg')
        ?? getStringField(clobStoreOrderResponseJson, 'message')
      const humanMessage = mapClobErrorMessage(responseError)
      const message = `Status ${clobStoreOrderResponse.status} (${clobStoreOrderResponse.statusText})`
      console.error('Failed to send order to CLOB.', message, responseError ?? responseText)
      return { error: humanMessage }
    }

    if (!clobStoreOrderResponseJson) {
      console.error('Failed to send order to CLOB. Empty or invalid response payload.')
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    if (clobStoreOrderResponseJson?.success === false) {
      const responseError = getStringField(clobStoreOrderResponseJson, 'errorMsg')
        ?? getStringField(clobStoreOrderResponseJson, 'error')
        ?? getStringField(clobStoreOrderResponseJson, 'message')
      return { error: mapClobErrorMessage(responseError) }
    }

    const clobOrderId = getStringField(clobStoreOrderResponseJson, 'orderID')
      ?? getStringField(clobStoreOrderResponseJson, 'orderId')
    if (!clobOrderId) {
      console.error('CLOB response did not include an order id.', clobStoreOrderResponseJson)
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    void OrderRepository.createOrder({
      ...validated.data,
      salt: BigInt(validated.data.salt),
      maker_amount: BigInt(validated.data.maker_amount),
      taker_amount: BigInt(validated.data.taker_amount),
      nonce: BigInt(validated.data.nonce),
      fee_rate_bps: Number(validated.data.fee_rate_bps),
      expiration: BigInt(validated.data.expiration),
      user_id: user.id,
      affiliate_user_id: user.referred_by_user_id,
      type: clobOrderType,
      clob_order_id: clobOrderId,
    })

    updateTag(cacheTags.activity(validated.data.slug))
    updateTag(cacheTags.holders(validated.data.condition_id))
  }
  catch (error) {
    console.error('Failed to create order.', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
