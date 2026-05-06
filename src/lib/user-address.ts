import type { User } from '@/types'

export function getUserPublicAddress(user?: User | null): string {
  return typeof user?.deposit_wallet_address === 'string' ? user.deposit_wallet_address : ''
}
