import { describe, expect, it, vi } from 'vitest'
import { waitForLiFiTransfer } from '@/lib/lifi-transfer'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const transfer = {
  txHash: '0xabc',
  fromChainId: 1,
  toChainId: 137,
  bridge: 'across',
}

describe('waitForLiFiTransfer', () => {
  it('waits until the destination transfer is complete', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        status: 'PENDING',
        substatus: 'WAIT_DESTINATION_TRANSACTION',
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'DONE',
        substatus: 'COMPLETED',
      }))
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
      wait,
    })).resolves.toMatchObject({
      status: 'DONE',
      substatus: 'COMPLETED',
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledTimes(1)
  })

  it('does not report refunded transfers as successful deposits', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      status: 'DONE',
      substatus: 'REFUNDED',
    }))

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('refunded')
  })

  it('surfaces LI.FI failure details', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      status: 'FAILED',
      substatus: 'SLIPPAGE_EXCEEDED',
      substatusMessage: 'The transfer exceeded its slippage limit.',
    }))

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('slippage limit')
  })
})
