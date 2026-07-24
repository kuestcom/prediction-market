import type { StatusMessage, Substatus } from '@lifi/sdk'

const LIFI_STATUS_POLL_INTERVAL_MS = 5_000
const LIFI_STATUS_MAX_ATTEMPTS = 120

interface LiFiTransferStatus {
  status: StatusMessage
  substatus?: Substatus
  substatusMessage?: string
}

interface WaitForLiFiTransferParams {
  txHash: string
  fromChainId: number
  toChainId: number
  bridge?: string
  fromAddress?: string
  transactionId?: string
}

interface WaitForLiFiTransferOptions {
  fetcher?: typeof fetch
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  signal?: AbortSignal
  maxAttempts?: number
}

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }

    const timeout = setTimeout(handleTimeout, milliseconds)

    function handleAbort() {
      clearTimeout(timeout)
      reject(signal?.reason)
    }

    function handleTimeout() {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function getTransferErrorMessage(status: LiFiTransferStatus) {
  if (status.substatusMessage) {
    return status.substatusMessage
  }
  if (status.substatus === 'REFUNDED') {
    return 'LI.FI refunded the transfer before it reached the deposit wallet.'
  }
  if (status.substatus === 'PARTIAL') {
    return 'LI.FI completed the transfer only partially.'
  }
  return 'LI.FI could not complete the transfer.'
}

export async function waitForLiFiTransfer(
  params: WaitForLiFiTransferParams,
  options: WaitForLiFiTransferOptions = {},
) {
  const fetcher = options.fetcher ?? fetch
  const waitForNextPoll = options.wait ?? wait
  const maxAttempts = options.maxAttempts ?? LIFI_STATUS_MAX_ATTEMPTS

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('LI.FI status polling requires at least one attempt.')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    options.signal?.throwIfAborted()
    const response = await fetcher('/api/lifi/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: options.signal,
    })
    const data = await response.json().catch(() => null) as (LiFiTransferStatus & { error?: string }) | null

    if (!response.ok || !data) {
      throw new Error(data?.error ?? 'Failed to check LI.FI transfer status.')
    }

    if (data.status === 'DONE') {
      if (data.substatus === 'REFUNDED' || data.substatus === 'PARTIAL') {
        throw new Error(getTransferErrorMessage(data))
      }
      return data
    }

    if (data.status === 'FAILED') {
      throw new Error(getTransferErrorMessage(data))
    }

    if (attempt < maxAttempts) {
      await waitForNextPoll(LIFI_STATUS_POLL_INTERVAL_MS, options.signal)
    }
  }

  throw new Error('LI.FI transfer is still pending. Check its status before retrying.')
}
