import { parseGwei } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { AMOY_CHAIN_ID, POLYGON_MAINNET_CHAIN_ID } from '@/lib/network'
import { getFeeOverridesForChain, isGasFeeTooLowError, parseMinTipCapFromError, sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'

describe('transaction fees', () => {
  it('parses minimum tip cap values from provider errors', () => {
    expect(parseMinTipCapFromError('gas tip cap 100 below minimum needed 25000000000')).toBe(25_000_000_000n)
    expect(parseMinTipCapFromError('transaction underpriced')).toBeNull()
  })

  it('matches gas fee too low errors without matching generic transport errors', () => {
    expect(isGasFeeTooLowError('transaction underpriced')).toBe(true)
    expect(isGasFeeTooLowError('gas tip cap 100 below minimum needed 25000000000')).toBe(true)
    expect(isGasFeeTooLowError('requested rpc call is not allowed')).toBe(false)
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
      maxPriorityFeePerGas: 37_500_000_000n,
      maxFeePerGas: parseGwei('75'),
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
      maxPriorityFeePerGas: 37_500_000_000n,
      maxFeePerGas: parseGwei('75'),
    })
    expect(send).toHaveBeenNthCalledWith(2, {
      maxPriorityFeePerGas: parseGwei('50'),
      maxFeePerGas: parseGwei('100'),
    })
  })

  it('does not retry after the user rejects the wallet prompt', async () => {
    const send = vi.fn().mockRejectedValue(new Error('User rejected the request'))

    await expect(sendWithEstimatedFeeRetry({
      chainId: POLYGON_MAINNET_CHAIN_ID,
      client: {
        estimateFeesPerGas: vi.fn().mockResolvedValue({
          maxFeePerGas: parseGwei('50'),
          maxPriorityFeePerGas: parseGwei('25'),
        }),
        getGasPrice: vi.fn(),
      },
      send,
    })).rejects.toThrow('User rejected the request')

    expect(send).toHaveBeenCalledTimes(1)
  })
})
