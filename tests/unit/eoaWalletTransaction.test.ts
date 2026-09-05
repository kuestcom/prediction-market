import { describe, expect, it } from 'bun:test'

import {
  buildRpcWalletTransactionRequest,
  isEmbeddedWalletProvider,
  readWalletTransactionHash,
  resolveWalletChainId,
} from '@/lib/wallet/eoa-transaction'

describe('EOA wallet transactions', () => {
  it('detects the AppKit auth provider used by email and social wallets', () => {
    const provider = {
      request: async () => undefined,
      connectEmail: () => undefined,
      connectSocial: () => undefined,
      getEmail: () => undefined,
      switchNetwork: () => undefined,
    }

    expect(isEmbeddedWalletProvider(provider)).toBe(true)
    expect(isEmbeddedWalletProvider({ request: async () => undefined })).toBe(false)
  })

  it('builds the raw eth_sendTransaction request expected by embedded wallets', () => {
    expect(
      buildRpcWalletTransactionRequest({
        from: '0x0000000000000000000000000000000000000001',
        to: '0x0000000000000000000000000000000000000002',
        data: '0x1234',
        value: 0n,
        gas: 100_000n,
      }),
    ).toEqual({
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      data: '0x1234',
      value: '0x0',
      gas: '0x186a0',
    })
  })

  it('normalizes AppKit chain IDs and rejects malformed transaction hashes', () => {
    expect(resolveWalletChainId(80002)).toBe(80002)
    expect(resolveWalletChainId('80002')).toBe(80002)
    expect(resolveWalletChainId('eip155:80002')).toBe(80002)
    expect(resolveWalletChainId(undefined)).toBeNull()
    expect(readWalletTransactionHash(`0x${'ab'.repeat(32)}`)).toBe(`0x${'ab'.repeat(32)}`)
    expect(() => readWalletTransactionHash('0x1234')).toThrow('invalid transaction hash')
  })
})
