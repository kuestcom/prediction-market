import { POLYGON_MAINNET_CHAIN_ID } from '@/lib/network'

interface PolymarketConnectionCandidate {
  accounts: readonly string[]
  chainId: number
  connector: {
    id: string
    uid: string
  }
}

export function selectPolymarketConnection<T extends PolymarketConnectionCandidate>(
  connections: readonly T[],
  {
    ownerAddress,
    connectorId,
    connectorUid,
  }: {
    ownerAddress: string
    connectorId: string | null | undefined
    connectorUid: string | null | undefined
  },
) {
  const ownerConnections = connections.filter(connection => (
    connection.accounts.some(account => account.toLowerCase() === ownerAddress.toLowerCase())
  ))
  const exactConnection = connectorUid
    ? ownerConnections.find(connection => connection.connector.uid === connectorUid)
    : undefined
  if (exactConnection) {
    return exactConnection
  }

  const connectorMatches = connectorId
    ? ownerConnections.filter(connection => connection.connector.id === connectorId)
    : []
  return connectorMatches.length === 1 ? connectorMatches[0] : undefined
}

export function shouldSwitchPolymarketChain({
  connectionChainId,
}: {
  connectionChainId: number
}) {
  return connectionChainId !== POLYGON_MAINNET_CHAIN_ID
}

export async function runOnPolymarketChain<T>({
  connectionChainId,
  switchToPolymarket,
  restoreOriginalChain,
  operation,
}: {
  connectionChainId: number
  switchToPolymarket: () => Promise<unknown>
  restoreOriginalChain: () => Promise<unknown>
  operation: () => Promise<T>
}) {
  const shouldSwitch = shouldSwitchPolymarketChain({ connectionChainId })
  if (!shouldSwitch) {
    return operation()
  }

  await switchToPolymarket()
  let operationResult: T | undefined
  let operationError: unknown
  let operationFailed = false
  try {
    operationResult = await operation()
  }
  catch (error) {
    operationFailed = true
    operationError = error
  }

  try {
    await restoreOriginalChain()
  }
  catch (restoreError) {
    if (!operationFailed) {
      throw restoreError
    }
  }

  if (operationFailed) {
    throw operationError
  }
  return operationResult as T
}
