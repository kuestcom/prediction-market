import { DEFAULT_THEME_SITE_NAME } from '@/lib/theme-site-identity'

interface UmaProposeSource {
  uma_request_tx_hash?: string | null
  uma_request_log_index?: number | null
  mirror_uma_request_tx_hash?: string | null
  mirror_uma_request_log_index?: number | null
}

const UMA_ORACLE_BASE_URL = 'https://oracle.uma.xyz'

export interface UmaProposeTarget {
  url: string
  isMirror: boolean
}

interface UmaRequestParams {
  txHash: string
  logIndex: number
  isMirror: boolean
}

function resolveUmaProject(projectName: string | null | undefined) {
  const normalized = projectName?.trim()
  return normalized && normalized.length > 0 ? normalized : DEFAULT_THEME_SITE_NAME
}

function resolveUmaRequestParams(source?: UmaProposeSource | null): UmaRequestParams | null {
  if (!source) {
    return null
  }

  const mirrorTxHash = source.mirror_uma_request_tx_hash
  const mirrorLogIndex = source.mirror_uma_request_log_index
  const directTxHash = source.uma_request_tx_hash
  const directLogIndex = source.uma_request_log_index

  const isMirror = Boolean(mirrorTxHash && mirrorLogIndex != null)
  const txHash = isMirror ? mirrorTxHash : directTxHash
  const logIndex = isMirror ? mirrorLogIndex : directLogIndex

  if (!txHash || logIndex == null) {
    return null
  }

  return {
    txHash,
    logIndex,
    isMirror,
  }
}

export function resolveUmaProposeTarget(source?: UmaProposeSource | null, projectName?: string | null): UmaProposeTarget | null {
  const requestParams = resolveUmaRequestParams(source)
  if (!requestParams) {
    return null
  }

  const baseUrl = UMA_ORACLE_BASE_URL.replace(/\/$/, '')
  const project = resolveUmaProject(projectName)

  const query = new URLSearchParams()
  query.set('project', project)
  query.set('transactionHash', requestParams.txHash)
  query.set('eventIndex', String(requestParams.logIndex))

  return {
    url: `${baseUrl}/propose?${query.toString()}`,
    isMirror: requestParams.isMirror,
  }
}

export function buildUmaProposeUrl(source?: UmaProposeSource | null, projectName?: string | null): string | null {
  return resolveUmaProposeTarget(source, projectName)?.url ?? null
}

export function buildUmaSettledUrl(source?: UmaProposeSource | null, projectName?: string | null): string | null {
  const requestParams = resolveUmaRequestParams(source)
  if (!requestParams) {
    return null
  }

  const baseUrl = UMA_ORACLE_BASE_URL.replace(/\/$/, '')
  const project = resolveUmaProject(projectName)
  const query = new URLSearchParams()
  query.set('project', project)
  query.set('transactionHash', requestParams.txHash)
  query.set('eventIndex', String(requestParams.logIndex))

  return `${baseUrl}/settled?${query.toString()}`
}
