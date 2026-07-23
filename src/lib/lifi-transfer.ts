import type { StatusMessage, Substatus } from '@lifi/sdk'

const LIFI_STATUS_POLL_INTERVAL_MS = 5_000

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
  wait?: (milliseconds: number) => Promise<void>
}

function wait(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds))
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

  while (true) {
    const response = await fetcher('/api/lifi/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
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

    await waitForNextPoll(LIFI_STATUS_POLL_INTERVAL_MS)
  }
}
