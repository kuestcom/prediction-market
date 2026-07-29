import type {
  PendingRequestItem,
  PrepareFinalizeRequestTx,
  PrepareResponse,
  SignatureExecutionTx,
} from './admin-create-event-form-types'

export interface LoadedSignaturePlan {
  pending: PendingRequestItem
  prepared: PrepareResponse
  signatureTxs: SignatureExecutionTx[]
}

export interface RpcWalletProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

export type PreSignIndicatorState = 'idle' | 'checking' | 'ok' | 'error'

export function buildSignatureExecutionTxs(
  prepared: PrepareResponse,
  confirmedTxs: PrepareFinalizeRequestTx[],
): SignatureExecutionTx[] {
  const confirmedById = new Map(confirmedTxs.map((item) => [item.id, item.hash]))
  return prepared.txPlan.map((planned) => {
    const hash = confirmedById.get(planned.id)
    return {
      ...planned,
      status: hash ? 'success' : 'idle',
      hash: hash ?? undefined,
    }
  })
}

function buildMetadataUpdatePreparedPlan(pending: PendingRequestItem): PrepareResponse | null {
  if (!pending.prepared || pending.status !== 'metadata_update_pending' || !pending.metadataUpdateTxPlan?.length) {
    return pending.prepared
  }

  return {
    ...pending.prepared,
    txPlan: pending.metadataUpdateTxPlan,
  }
}

export function buildLoadedSignaturePlan(pending: PendingRequestItem): LoadedSignaturePlan | null {
  const prepared = buildMetadataUpdatePreparedPlan(pending)
  if (!prepared) {
    return null
  }

  return {
    pending,
    prepared,
    signatureTxs: buildSignatureExecutionTxs(prepared, pending.txs),
  }
}

export function isFinalizationPendingStatus(status: string) {
  return status === 'finalized' || status === 'finalize_running' || status === 'finalize_in_progress'
}

export function isRpcWalletProvider(value: unknown): value is RpcWalletProvider {
  return Boolean(value) && typeof value === 'object' && typeof (value as { request?: unknown }).request === 'function'
}

export function isEmbeddedWalletProvider(value: unknown): value is RpcWalletProvider {
  if (!isRpcWalletProvider(value)) {
    return false
  }

  const candidate = value as {
    connectEmail?: unknown
    connectSocial?: unknown
    getEmail?: unknown
    switchNetwork?: unknown
    constructor?: { name?: string }
  }

  return (
    candidate.constructor?.name === 'W3mFrameProvider' ||
    (typeof candidate.connectEmail === 'function' &&
      typeof candidate.connectSocial === 'function' &&
      typeof candidate.getEmail === 'function' &&
      typeof candidate.switchNetwork === 'function')
  )
}

export function resolveChainId(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function isSameAddress(first?: string | null, second?: string | null) {
  return Boolean(first && second && first.toLowerCase() === second.toLowerCase())
}

export function getCheckIndicatorState(state: string, okState = 'ok'): PreSignIndicatorState {
  if (state === okState) {
    return 'ok'
  }
  if (state === 'checking') {
    return 'checking'
  }
  if (state === 'idle') {
    return 'idle'
  }
  return 'error'
}
