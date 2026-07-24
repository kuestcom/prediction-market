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

  it('does not report partially completed transfers as successful deposits', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      status: 'DONE',
      substatus: 'PARTIAL',
    }))

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('completed the transfer only partially')
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

  it('surfaces LI.FI status API errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      error: 'LI.FI status service unavailable.',
    }, 500))

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('LI.FI status service unavailable')
  })

  it('falls back to a generic error for malformed status API responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('not json', { status: 500 }))

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('Failed to check LI.FI transfer status')
  })

  it('stops polling when the transfer remains pending', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({
      status: 'PENDING',
      substatus: 'WAIT_DESTINATION_TRANSACTION',
    })))
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
      wait,
      maxAttempts: 2,
    })).rejects.toThrow('still pending')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledTimes(1)
  })

  it('passes cancellation through to LI.FI status requests', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    })
    const transferPromise = waitForLiFiTransfer(transfer, {
      fetcher: fetcher as typeof fetch,
      signal: controller.signal,
    })

    controller.abort()

    await expect(transferPromise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).toHaveBeenCalledWith('/api/lifi/status', expect.objectContaining({
      signal: controller.signal,
    }))
  })
})
