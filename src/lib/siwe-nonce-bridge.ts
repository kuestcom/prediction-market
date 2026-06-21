import { generateRandomString } from 'better-auth/crypto'

import { and, eq, lt } from 'drizzle-orm'
import { getAddress, isAddress } from 'viem'
import { verifications } from '@/lib/db/schema/auth/tables'
import { db } from '@/lib/drizzle'
import 'server-only'

const SIWE_NONCE_TTL_MS = 15 * 60 * 1000
const VERIFICATION_ID_LENGTH = 26
const PENDING_SIWE_NONCE_PREFIX = 'siwe:pending:'

function normalizeWalletAddress(walletAddress: string) {
  const normalized = walletAddress.trim().replace(/^0X/u, '0x')
  return isAddress(normalized) ? getAddress(normalized) : null
}

function pendingIdentifier(nonce: string) {
  return `${PENDING_SIWE_NONCE_PREFIX}${nonce}`
}

function walletIdentifier(walletAddress: string, chainId: number) {
  return `siwe:${walletAddress}:${chainId}`
}

function createExpiry() {
  return new Date(Date.now() + SIWE_NONCE_TTL_MS)
}

export async function createPendingSiweNonce() {
  const nonce = generateRandomString(32)
  const now = new Date()

  await db.delete(verifications).where(lt(verifications.expires_at, now))
  await db.insert(verifications).values({
    id: generateRandomString(VERIFICATION_ID_LENGTH),
    identifier: pendingIdentifier(nonce),
    value: nonce,
    expires_at: createExpiry(),
    created_at: now,
    updated_at: now,
  })

  return nonce
}

export async function bindPendingSiweNonce({
  chainId,
  nonce,
  walletAddress,
}: {
  chainId: number
  nonce: string
  walletAddress: string
}) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress)
  if (!normalizedWalletAddress || !Number.isInteger(chainId) || chainId <= 0 || !nonce.trim()) {
    return { ok: false, error: 'Invalid SIWE nonce binding request.' }
  }

  const identifier = pendingIdentifier(nonce)
  const now = new Date()

  return await db.transaction(async (tx) => {
    const consumedPendingNonces = await tx
      .delete(verifications)
      .where(and(eq(verifications.identifier, identifier), eq(verifications.value, nonce)))
      .returning({
        expires_at: verifications.expires_at,
      })

    const pendingNonce = consumedPendingNonces.find(row => row.expires_at >= now)
    if (!pendingNonce) {
      return { ok: false, error: 'SIWE nonce is invalid or expired.' }
    }

    await tx.insert(verifications).values({
      id: generateRandomString(VERIFICATION_ID_LENGTH),
      identifier: walletIdentifier(normalizedWalletAddress, chainId),
      value: nonce,
      expires_at: pendingNonce.expires_at,
      created_at: now,
      updated_at: now,
    })

    return { ok: true, walletAddress: normalizedWalletAddress }
  })
}
