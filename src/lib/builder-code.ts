import type { Address } from 'viem'
import { isAddress, zeroAddress } from 'viem'
import { ZERO_BYTES32 } from '@/lib/contracts'

export function addressToBuilderCode(address?: Address | string | null): `0x${string}` {
  if (!address || !isAddress(address) || address.toLowerCase() === zeroAddress) {
    return ZERO_BYTES32
  }

  return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}`
}
