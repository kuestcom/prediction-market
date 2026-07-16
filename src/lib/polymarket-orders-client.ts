'use client'

import type { ApiKeyCreds, OrderResponse } from '@polymarket/clob-client-v2'
import type { Address } from 'viem'
import type { Config } from 'wagmi'
import type { PolymarketTickSize } from '@/lib/polymarket-market'
import {
  ApiError,
  Chain,
  ClobClient,
  createL2Headers,
  isV2Order,
  orderToJsonV1,
  orderToJsonV2,
  OrderType,
  Side,
  SignatureTypeV2,
} from '@polymarket/clob-client-v2'
import { getConnections, getWalletClient, switchChain } from 'wagmi/actions'
import { POLYGON_MAINNET_CHAIN_ID } from '@/lib/network'
import {
  runOnPolymarketChain,
  selectPolymarketConnection,
} from '@/lib/polymarket-connection'

const credentialsByOwner = new Map<string, Promise<ApiKeyCreds>>()
const POLYMARKET_ORDER_PATH = '/order'
const POLYMARKET_CREDENTIALS_SESSION_PREFIX = 'kuest:polymarket-clob-credentials:'
export const POLYMARKET_MIN_MARKETABLE_BUY_AMOUNT = 1

export class PolymarketAuthenticationError extends Error {
  constructor(cause?: unknown) {
    super('Polymarket authentication failed.', { cause })
    this.name = 'PolymarketAuthenticationError'
  }
}

export async function deriveOrCreatePolymarketCredentials(
  client: Pick<ClobClient, 'deriveApiKey' | 'createApiKey'>,
) {
  try {
    return await client.deriveApiKey()
  }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 400) {
      throw error
    }
    return client.createApiKey()
  }
}

function getSessionCredentials(client: ClobClient, ownerAddress: Address) {
  const key = ownerAddress.toLowerCase()
  const cached = credentialsByOwner.get(key)
  if (cached) {
    return cached
  }

  const stored = readStoredSessionCredentials(key)
  const pending = stored
    ? Promise.resolve(stored)
    : deriveOrCreatePolymarketCredentials(client)
        .then((credentials) => {
          storeSessionCredentials(key, credentials)
          return credentials
        })
        .catch((error) => {
          credentialsByOwner.delete(key)
          throw new PolymarketAuthenticationError(error)
        })
  credentialsByOwner.set(key, pending)
  return pending
}

function readStoredSessionCredentials(ownerAddress: string) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(`${POLYMARKET_CREDENTIALS_SESSION_PREFIX}${ownerAddress}`)
    const value = raw ? JSON.parse(raw) as Partial<ApiKeyCreds> : null
    return value?.key && value.secret && value.passphrase
      ? { key: value.key, secret: value.secret, passphrase: value.passphrase }
      : null
  }
  catch {
    return null
  }
}

function storeSessionCredentials(ownerAddress: string, credentials: ApiKeyCreds) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      `${POLYMARKET_CREDENTIALS_SESSION_PREFIX}${ownerAddress}`,
      JSON.stringify(credentials),
    )
  }
  catch {}
}

interface PreparePolymarketOrderArgs {
  wagmiConfig: Config
  ownerAddress: Address
  funderAddress: Address
  signatureType: 0 | 1 | 2 | 3
  connectorId: string
  connectorUid: string
  tokenId: string
  price: number
  shares: number
  tickSize: PolymarketTickSize
}

export function buildPolymarketLimitOrder({
  tokenId,
  price,
  shares,
}: Pick<PreparePolymarketOrderArgs, 'tokenId' | 'price' | 'shares'>) {
  const normalizedPrice = price
  const normalizedShares = Number(shares.toFixed(2))
  const makerAmountCents = normalizedPrice * normalizedShares * 100
  if (Math.abs(makerAmountCents - Math.round(makerAmountCents)) > 1e-7) {
    throw new Error('Polymarket FOK maker amount must use cents precision.')
  }
  if (makerAmountCents < POLYMARKET_MIN_MARKETABLE_BUY_AMOUNT * 100) {
    throw new Error('Polymarket marketable BUY amount must be at least $1.')
  }

  return {
    tokenID: tokenId,
    price: normalizedPrice,
    size: normalizedShares,
    side: Side.BUY,
  }
}

export async function ensurePolymarketOrderReady(tokenId: string) {
  const params = new URLSearchParams({ tokenId })
  const response = await fetch(`/api/arbitrage/polymarket-order?${params}`, {
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null) as { error?: unknown, ready?: unknown } | null
  if (!response.ok || data?.ready !== true) {
    throw new ApiError(
      typeof data?.error === 'string' ? data.error : 'Polymarket order service is temporarily unavailable.',
      response.status,
      data,
    )
  }
}

export async function preparePolymarketOrder({
  wagmiConfig,
  ownerAddress,
  funderAddress,
  signatureType,
  connectorId,
  connectorUid,
  tokenId,
  price,
  shares,
  tickSize,
}: PreparePolymarketOrderArgs) {
  await ensurePolymarketOrderReady(tokenId)

  const connection = selectPolymarketConnection(getConnections(wagmiConfig), {
    ownerAddress,
    connectorId,
    connectorUid,
  })
  if (!connection) {
    throw new Error('Polymarket wallet session is not connected.')
  }

  const connectionChainId = await connection.connector.getChainId()
  return runOnPolymarketChain({
    connectionChainId,
    switchToPolymarket: () => switchChain(wagmiConfig, {
      chainId: POLYGON_MAINNET_CHAIN_ID,
      connector: connection.connector,
    }),
    restoreOriginalChain: () => switchChain(wagmiConfig, {
      chainId: connectionChainId,
      connector: connection.connector,
    }),
    operation: async () => {
      const signer = await getWalletClient(wagmiConfig, {
        account: ownerAddress,
        chainId: POLYGON_MAINNET_CHAIN_ID,
        connector: connection.connector,
      })
      const authClient = new ClobClient({
        host: 'https://clob.polymarket.com',
        chain: Chain.POLYGON,
        signer,
        useServerTime: true,
        throwOnError: true,
      })
      const creds = await getSessionCredentials(authClient, ownerAddress)
      const client = new ClobClient({
        host: 'https://clob.polymarket.com',
        chain: Chain.POLYGON,
        signer,
        creds,
        signatureType: signatureType === 3
          ? SignatureTypeV2.POLY_1271
          : signatureType === 2
            ? SignatureTypeV2.POLY_GNOSIS_SAFE
            : signatureType === 1
              ? SignatureTypeV2.POLY_PROXY
              : SignatureTypeV2.EOA,
        funderAddress,
        useServerTime: true,
        throwOnError: true,
      })
      const negRisk = await client.getNegRisk(tokenId)
      const order = await client.createOrder(
        buildPolymarketLimitOrder({ tokenId, price, shares }),
        { tickSize, negRisk },
      )
      const orderPayload = isV2Order(order)
        ? orderToJsonV2(order, creds.key, OrderType.FOK)
        : orderToJsonV1(order, creds.key, OrderType.FOK)

      return {
        post: async () => {
          const body = JSON.stringify(orderPayload)
          const headers = await createL2Headers(signer, creds, {
            method: 'POST',
            requestPath: POLYMARKET_ORDER_PATH,
            body,
          }, await client.getServerTime())
          const response = await fetch('/api/arbitrage/polymarket-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headers, body }),
          })
          const responseText = await response.text()
          const data = (() => {
            try {
              return JSON.parse(responseText) as Partial<OrderResponse> & { error?: unknown }
            }
            catch {
              return { error: responseText || 'Polymarket returned an invalid response.' }
            }
          })()
          if (!response.ok) {
            throw new ApiError(
              typeof data.error === 'string' ? data.error : 'Polymarket rejected the order.',
              response.status,
              data,
            )
          }
          return data
        },
      }
    },
  })
}
