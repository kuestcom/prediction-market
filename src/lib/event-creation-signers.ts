import { privateKeyToAccount } from 'viem/accounts'
import 'server-only'

export interface EventCreationSigner {
  address: string
  privateKey: `0x${string}`
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    return null
  }

  return normalized as `0x${string}`
}

export function parseEventCreationSignerPrivateKeys(input: string | undefined | null) {
  const raw = input?.trim()
  if (!raw) {
    return []
  }

  let values: string[] = []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      values = parsed.filter((item): item is string => typeof item === 'string')
    }
  }
  catch {
    values = raw.split(/[\n,]+/g)
  }

  const signers = new Map<string, EventCreationSigner>()
  for (const value of values) {
    const privateKey = normalizePrivateKey(value)
    if (!privateKey) {
      continue
    }

    const account = privateKeyToAccount(privateKey)
    signers.set(account.address.toLowerCase(), {
      address: account.address.toLowerCase(),
      privateKey,
    })
  }

  return [...signers.values()]
}

export function loadEventCreationSignersFromEnv() {
  return parseEventCreationSignerPrivateKeys(process.env.EVENT_CREATION_SIGNER_PRIVATE_KEYS)
}
