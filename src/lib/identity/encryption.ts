import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import 'server-only'

const PREFIX = 'identity.enc.v1'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

interface IdentityKeyring {
  currentKeyId: string
  keys: Map<string, Buffer>
}

let cachedKeyringSource: string | null = null
let cachedKeyring: IdentityKeyring | null = null

function parseBase64Key(value: string, variableName: string) {
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== value.trim().replace(/=+$/, '')) {
    throw new Error(`${variableName} must be a base64-encoded 32-byte key.`)
  }
  return key
}

function resolveIdentityKeyring(): IdentityKeyring {
  const serializedKeys = process.env.IDENTITY_ENCRYPTION_KEYS?.trim() ?? ''
  const singleKey = process.env.IDENTITY_ENCRYPTION_KEY?.trim() ?? ''
  const currentKeyIdEnv = process.env.IDENTITY_ENCRYPTION_CURRENT_KEY_ID?.trim() ?? ''
  const source = `${serializedKeys}\n${singleKey}\n${currentKeyIdEnv}`

  if (cachedKeyring && cachedKeyringSource === source) {
    return cachedKeyring
  }

  const keys = new Map<string, Buffer>()
  if (serializedKeys) {
    let parsed: unknown
    try {
      parsed = JSON.parse(serializedKeys)
    }
    catch {
      throw new Error('IDENTITY_ENCRYPTION_KEYS must be a JSON object of key IDs to base64 keys.')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('IDENTITY_ENCRYPTION_KEYS must be a JSON object of key IDs to base64 keys.')
    }
    for (const [keyId, value] of Object.entries(parsed)) {
      if (!/^[\w.-]{1,32}$/.test(keyId) || typeof value !== 'string') {
        throw new Error('IDENTITY_ENCRYPTION_KEYS contains an invalid key ID or value.')
      }
      keys.set(keyId, parseBase64Key(value, `IDENTITY_ENCRYPTION_KEYS.${keyId}`))
    }
  }
  else if (singleKey) {
    keys.set(currentKeyIdEnv || 'v1', parseBase64Key(singleKey, 'IDENTITY_ENCRYPTION_KEY'))
  }

  if (keys.size === 0) {
    throw new Error('Configure IDENTITY_ENCRYPTION_KEYS or IDENTITY_ENCRYPTION_KEY before collecting identity data.')
  }

  const currentKeyId = currentKeyIdEnv || keys.keys().next().value
  if (!currentKeyId || !keys.has(currentKeyId)) {
    throw new Error('IDENTITY_ENCRYPTION_CURRENT_KEY_ID does not exist in the configured identity keyring.')
  }

  cachedKeyringSource = source
  cachedKeyring = { currentKeyId, keys }
  return cachedKeyring
}

function buildAdditionalData(context: string) {
  return Buffer.from(`${PREFIX}:${context}`, 'utf8')
}

export function encryptIdentityValue(value: unknown, context: string) {
  return encryptIdentityBytes(Buffer.from(JSON.stringify(value), 'utf8'), context)
}

export function encryptIdentityBytes(plaintext: Uint8Array, context: string) {
  const keyring = resolveIdentityKeyring()
  const key = keyring.keys.get(keyring.currentKeyId)!
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(buildAdditionalData(context))
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, encrypted]).toString('base64')

  return {
    encryptedValue: `${PREFIX}.${keyring.currentKeyId}.${payload}`,
    keyId: keyring.currentKeyId,
  }
}

export function decryptIdentityValue<T = unknown>(encryptedValue: string, context: string): T {
  return JSON.parse(decryptIdentityBytes(encryptedValue, context).toString('utf8')) as T
}

export function decryptIdentityBytes(encryptedValue: string, context: string) {
  const parts = encryptedValue.split('.')
  if (parts.length !== 5 || parts.slice(0, 3).join('.') !== PREFIX) {
    throw new Error('Unsupported identity ciphertext format.')
  }

  const keyId = parts[3]!
  const payload = Buffer.from(parts[4]!, 'base64')
  if (payload.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid identity ciphertext.')
  }

  const keyring = resolveIdentityKeyring()
  const key = keyring.keys.get(keyId)
  if (!key) {
    throw new Error('Identity encryption key is not available.')
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAAD(buildAdditionalData(context))
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function createIdentityBlindIndex(fieldKey: string, normalizedValue: string) {
  const encodedKey = process.env.IDENTITY_BLIND_INDEX_KEY?.trim()
  if (!encodedKey) {
    throw new Error('IDENTITY_BLIND_INDEX_KEY is required for fields with duplicate detection.')
  }
  const key = parseBase64Key(encodedKey, 'IDENTITY_BLIND_INDEX_KEY')
  return createHmac('sha256', key)
    .update(`identity-blind-index:v1:${fieldKey}\0${normalizedValue}`, 'utf8')
    .digest('base64url')
}

export function getIdentityCurrentEncryptionKeyId() {
  return resolveIdentityKeyring().currentKeyId
}

export function resetIdentityEncryptionKeyringForTests() {
  cachedKeyring = null
  cachedKeyringSource = null
}
