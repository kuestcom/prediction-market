'use server'

import { getExtracted } from 'next-intl/server'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import { CLOB_ORDER_TYPE, ORDER_TYPE } from '@/lib/constants'
import { OrderRepository } from '@/lib/db/queries/order'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
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
  timestamp: z.string(),
  metadata: z.string(),
  builder: z.string(),
  signature: z.string(),
  // end blockchain data

  type: z.union([z.literal(ORDER_TYPE.MARKET), z.literal(ORDER_TYPE.LIMIT)]),
  clob_type: z.enum(CLOB_ORDER_TYPE).optional(),
  condition_id: z.string(),
  slug: z.string(),
})

type StoreOrderInput = z.infer<typeof StoreOrderSchema>

const CLOB_REQUEST_TIMEOUT_MS = 20_000

type ClobErrorMessageKey
  = | 'default'
    | 'conditionPaused'
    | 'systemPaused'
    | 'marketNotActive'
    | 'tradingSessionOutOfSync'
    | 'tradingSessionExpired'
    | 'userBanned'
    | 'tradingUnavailable'
    | 'invalidOrderSignature'
    | 'orderExpired'
    | 'invalidExpiration'
    | 'duplicateOrder'
    | 'notEnoughLiquidity'
    | 'marketUnavailable'
    | 'orderSizeTooSmall'
    | 'invalidPrice'
    | 'insufficientBalance'
    | 'onChainPrecheckFailed'
    | 'onChainSettlementFailed'
    | 'couldNotSubmit'
    | 'couldNotExecute'
    | 'orderDelayed'
    | 'matchingDelayed'
    | 'invalidExpirationRefreshPrices'
    | 'staleMarketData'
    | 'postOnlyLimitOrders'
    | 'postOnlyWouldCross'
    | 'invalidOrderSize'
    | 'outdatedTradingSettings'
    | 'orderExecutionFailed'

const CLOB_ERROR_MESSAGES: Record<string, ClobErrorMessageKey> = {
  'condition_paused': 'conditionPaused',
  'system_paused': 'systemPaused',
  'condition is not registered': 'marketNotActive',
  'token is not registered': 'marketNotActive',
  'owner_address_mismatch': 'tradingSessionOutOfSync',
  'invalid_l2': 'tradingSessionExpired',
  'user_banned': 'userBanned',
  'internal_error': 'tradingUnavailable',
  'invalid order signature': 'invalidOrderSignature',
  'order expired': 'orderExpired',
  'invalid expiration': 'invalidExpiration',
  'order is invalid. duplicated. same order has already been placed, can\'t be placed again': 'duplicateOrder',
  'order couldn\'t be fully filled, fok orders are fully filled/killed': 'notEnoughLiquidity',
  'market not yet accepting orders': 'conditionPaused',
  'the market is not yet ready to process new orders': 'marketUnavailable',
  'order is invalid. size lower than the minimum': 'orderSizeTooSmall',
  'order is invalid. price breaks minimum tick size rules': 'invalidPrice',
  'not enough balance / allowance': 'insufficientBalance',
  'on-chain precheck failed': 'onChainPrecheckFailed',
  'on-chain settlement failed': 'onChainSettlementFailed',
  'could not insert order': 'couldNotSubmit',
  'could not run the execution': 'couldNotExecute',
  'error delaying the order': 'orderDelayed',
  'order match delayed due to market conditions': 'matchingDelayed',
}

const CLOB_ERROR_PATTERNS: Array<{ pattern: RegExp, messageKey: ClobErrorMessageKey }> = [
  {
    pattern: /\b(not enough (unlocked )?balance|insufficient unlocked (position|collateral)|insufficient unlocked)\b/i,
    messageKey: 'insufficientBalance',
  },
  {
    pattern: /\b(order .* expired|expiration must be in the future|expiration must be non-negative|expiration is required)\b/i,
    messageKey: 'invalidExpirationRefreshPrices',
  },
  {
    pattern: /\b(tokenid is required|conditionid is required|tokenid not found for conditionid lookup|maker is required|signer is required)\b/i,
    messageKey: 'staleMarketData',
  },
  {
    pattern: /\b(postonly requires gtc or gtd)\b/i,
    messageKey: 'postOnlyLimitOrders',
  },
  {
    pattern: /\b(postonly would cross the best (ask|bid))\b/i,
    messageKey: 'postOnlyWouldCross',
  },
  {
    pattern: /\b(orderbook not ready|market is not yet ready|market not yet accepting orders|unable to derive price for postonly|unable to derive price for order)\b/i,
    messageKey: 'marketUnavailable',
  },
  {
    pattern: /\b(failed to verify signature|invalid signature for order)\b/i,
    messageKey: 'invalidOrderSignature',
  },
  {
    pattern: /\b(failed to check balances|makeramount must be positive|order quantity must be positive|makeramount and takeramount must be positive)\b/i,
    messageKey: 'invalidOrderSize',
  },
  {
    pattern: /\b(unsupported verifying contract|feeratebps must be >= exchangebasefeerate|feeratebps must be non-negative)\b/i,
    messageKey: 'outdatedTradingSettings',
  },
  {
    pattern: /\b(transaction reverted|transport error|condition worker dropped response)\b/i,
    messageKey: 'orderExecutionFailed',
  },
]

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

function mapClobErrorMessageKey(rawError: string | null): ClobErrorMessageKey {
  if (!rawError) {
    return 'default'
  }
  const normalized = rawError.trim()
  if (!normalized) {
    return 'default'
  }

  const lower = normalized.toLowerCase()
  const mapped = CLOB_ERROR_MESSAGES[lower]
  if (mapped) {
    return mapped
  }

  for (const { pattern, messageKey } of CLOB_ERROR_PATTERNS) {
    if (pattern.test(lower)) {
      return messageKey
    }
  }

  console.error('Unmapped CLOB error message.', normalized)
  return 'default'
}

async function mapClobErrorMessage(rawError: string | null) {
  const messageKey = mapClobErrorMessageKey(rawError)
  const t = await getExtracted()

  switch (messageKey) {
    case 'conditionPaused':
      return t('Trading is paused for this market.')
    case 'systemPaused':
      return t('Trading is temporarily paused. Please try again shortly.')
    case 'marketNotActive':
      return t('Market is not active yet. Try again shortly.')
    case 'tradingSessionOutOfSync':
      return t('Your trading session is out of sync. Reconnect and try again.')
    case 'tradingSessionExpired':
      return t('Your trading session expired. Please sign in again.')
    case 'userBanned':
      return t('Your account is not allowed to trade right now.')
    case 'tradingUnavailable':
      return t('Trading is temporarily unavailable. Please try again shortly.')
    case 'invalidOrderSignature':
      return t('Your order signature could not be verified. Please sign and try again.')
    case 'orderExpired':
      return t('This order expired. Refresh prices and submit again.')
    case 'invalidExpiration':
      return t('This order expiration is invalid. Please refresh and try again.')
    case 'duplicateOrder':
      return t('This exact order was already submitted.')
    case 'notEnoughLiquidity':
      return t('Not enough liquidity to fully fill this order right now.')
    case 'marketUnavailable':
      return t('This market is temporarily unavailable for trading. Please try again shortly.')
    case 'orderSizeTooSmall':
      return t('Order size is too small for this market.')
    case 'invalidPrice':
      return t('Order price is invalid for this market.')
    case 'insufficientBalance':
      return t('Insufficient available balance for this order.')
    case 'onChainPrecheckFailed':
      return t('We could not validate this order on-chain. Please try again.')
    case 'onChainSettlementFailed':
      return t('This order could not be settled right now. Please try again.')
    case 'couldNotSubmit':
      return t('Could not submit your order right now. Please try again.')
    case 'couldNotExecute':
      return t('Could not execute your order right now. Please try again.')
    case 'orderDelayed':
      return t('Order processing is delayed right now. Please try again.')
    case 'matchingDelayed':
      return t('Order matching is delayed due to market conditions.')
    case 'invalidExpirationRefreshPrices':
      return t('This order expiration is invalid. Refresh prices and try again.')
    case 'staleMarketData':
      return t('Market data is out of date. Please refresh and try again.')
    case 'postOnlyLimitOrders':
      return t('Post-only is only available for limit orders.')
    case 'postOnlyWouldCross':
      return t('Post-only orders must not execute immediately. Adjust the price and try again.')
    case 'invalidOrderSize':
      return t('Order size is invalid for this market.')
    case 'outdatedTradingSettings':
      return t('Trading settings are out of date. Refresh and try again.')
    case 'orderExecutionFailed':
      return t('Order execution failed. Please try again shortly.')
    case 'default':
      return t('Something went wrong while processing your order. Please try again.')
  }

  return t('Something went wrong while processing your order. Please try again.')
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

export async function storeOrderAction(payload: StoreOrderInput) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }
  if (!user.deposit_wallet_address) {
    return { error: 'Set up your Deposit Wallet before trading.' }
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
    const expectedMaker = normalizeAddress(user.deposit_wallet_address)
    const maker = normalizeAddress(validated.data.maker)
    const signer = normalizeAddress(validated.data.signer)

    if (!expectedMaker || !maker || !signer) {
      return { error: 'Invalid Deposit Wallet address for this order.' }
    }

    if (validated.data.signature_type !== 3) {
      return { error: 'Orders must use Deposit Wallet signature type.' }
    }

    if (maker.toLowerCase() !== expectedMaker.toLowerCase() || signer.toLowerCase() !== expectedMaker.toLowerCase()) {
      return { error: 'Invalid Deposit Wallet maker or signer for this order.' }
    }

    const clobPayload = {
      order: {
        salt: validated.data.salt,
        maker: validated.data.maker,
        signer: validated.data.signer,
        conditionId: validated.data.condition_id,
        tokenId: validated.data.token_id,
        makerAmount: validated.data.maker_amount,
        takerAmount: validated.data.taker_amount,
        expiration: validated.data.expiration,
        side: validated.data.side === 0 ? 'BUY' : 'SELL',
        signatureType: validated.data.signature_type,
        timestamp: validated.data.timestamp,
        metadata: validated.data.metadata,
        builder: validated.data.builder,
        signature: validated.data.signature,
      },
      orderType: clobOrderType,
      owner: auth.clob.key,
    }

    const method = 'POST'
    const path = '/order'
    const { clobUrl } = resolvePublicRuntimeEnv(process.env)
    const body = JSON.stringify(clobPayload)
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = buildClobHmacSignature(
      auth.clob.secret,
      timestamp,
      method,
      path,
      body,
    )

    const clobStoreOrderResponse = await fetch(`${clobUrl}${path}`, {
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
      const humanMessage = await mapClobErrorMessage(responseError)
      const message = `Status ${clobStoreOrderResponse.status} (${clobStoreOrderResponse.statusText})`
      console.error('Failed to send order to CLOB.', message, responseError ?? responseText)
      return { error: humanMessage }
    }

    if (!clobStoreOrderResponseJson) {
      console.error('Failed to send order to CLOB. Empty or invalid response payload.')
      return { error: await mapClobErrorMessage(null) }
    }

    if (clobStoreOrderResponseJson?.success === false) {
      const responseError = getStringField(clobStoreOrderResponseJson, 'errorMsg')
        ?? getStringField(clobStoreOrderResponseJson, 'error')
        ?? getStringField(clobStoreOrderResponseJson, 'message')
      return { error: await mapClobErrorMessage(responseError) }
    }

    const clobOrderId = getStringField(clobStoreOrderResponseJson, 'orderID')
      ?? getStringField(clobStoreOrderResponseJson, 'orderId')
    if (!clobOrderId) {
      console.error('CLOB response did not include an order id.', clobStoreOrderResponseJson)
      return { error: await mapClobErrorMessage(null) }
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

    return {
      error: null,
      orderId: clobOrderId,
    }
  }
  catch (error) {
    console.error('Failed to create order.', error)
    return { error: await mapClobErrorMessage(null) }
  }
}
