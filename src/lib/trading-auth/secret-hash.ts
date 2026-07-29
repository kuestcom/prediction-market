import { createHash } from 'node:crypto'
import 'server-only'

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function getBetterAuthSecretHash() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required.')
  }
  return sha256Hex(secret)
}
