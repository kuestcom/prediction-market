import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'enc.v1.'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const ALGORITHM = 'aes-256-gcm'

function resolveEncryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters to encrypt sensitive values.')
  }

  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string) {
  if (!value) {
    return ''
  }

  const key = resolveEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  const payload = Buffer.concat([iv, authTag, encrypted])

  return `${PREFIX}${payload.toString('base64')}`
}

export function decryptSecret(value: string | undefined | null) {
  if (!value) {
    return ''
  }

  if (!value.startsWith(PREFIX)) {
    return value
  }

  try {
    const key = resolveEncryptionKey()
    const payload = Buffer.from(value.slice(PREFIX.length), 'base64')
    const iv = payload.subarray(0, IV_LENGTH)
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Failed to decrypt secret value.', error)
    return ''
  }
}
