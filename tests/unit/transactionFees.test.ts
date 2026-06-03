import { parseGwei } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { AMOY_CHAIN_ID, POLYGON_MAINNET_CHAIN_ID } from '@/lib/network'
import { getFeeOverridesForChain, parseMinTipCapFromError, sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'

describe('transaction fees', () => {
  it('parses minimum tip cap values from provider errors', () => {
    expect(parseMinTipCapFromError('gas tip cap 100 below minimum needed 25000000000')).toBe(25_000_000_000n)
    expect(parseMinTipCapFromError('transaction underpriced')).toBeNull()
  })

  it('buffers estimated eip1559 fees and respects the Amoy priority floor', async () => {
    const overrides = await getFeeOverridesForChain({
      estimateFeesPerGas: vi.fn().mockResolvedValue({
        maxFeePerGas: parseGwei('30'),
        maxPriorityFeePerGas: parseGwei('10'),
      }),
      getGasPrice: vi.fn(),
    }, AMOY_CHAIN_ID)

    expect(overrides).toEqual({
      maxPriorityFeePerGas: parseGwei('30'),
      maxFeePerGas: parseGwei('60'),
    })
  })

  it('retries with the minimum tip cap when the provider reports an underpriced fee', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('gas tip cap 100 below minimum needed 25000000000'))
      .mockResolvedValueOnce('0xhash')

    const hash = await sendWithEstimatedFeeRetry({
      chainId: POLYGON_MAINNET_CHAIN_ID,
      client: {
        estimateFeesPerGas: vi.fn().mockResolvedValue({
          maxFeePerGas: parseGwei('50'),
          maxPriorityFeePerGas: parseGwei('25'),
        }),
        getGasPrice: vi.fn(),
      },
      send,
    })

    expect(hash).toBe('0xhash')
    expect(send).toHaveBeenNthCalledWith(1, {
      maxPriorityFeePerGas: parseGwei('30'),
      maxFeePerGas: parseGwei('60'),
    })
    expect(send).toHaveBeenNthCalledWith(2, {
      maxPriorityFeePerGas: parseGwei('30'),
      maxFeePerGas: parseGwei('60'),
    })
  })
})
