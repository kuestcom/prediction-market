import { WebSocketPlayground } from '@/app/[locale]/docs/_components/WebSocketPlayground'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'

const publicRuntimeServiceUrlSelectors = {
  clob: (config: ReturnType<typeof resolvePublicRuntimeEnv>) => config.clobUrl,
  data: (config: ReturnType<typeof resolvePublicRuntimeEnv>) => config.dataUrl,
  gamma: (config: ReturnType<typeof resolvePublicRuntimeEnv>) => config.gammaUrl,
  wsClob: (config: ReturnType<typeof resolvePublicRuntimeEnv>) => config.wsClobUrl,
  wsLiveData: (config: ReturnType<typeof resolvePublicRuntimeEnv>) => config.wsLiveDataUrl,
}

type PublicRuntimeService = keyof typeof publicRuntimeServiceUrlSelectors
type PublicRuntimeWebSocketService = Extract<PublicRuntimeService, 'wsClob' | 'wsLiveData'>

interface PublicRuntimeServiceUrlProps {
  service: PublicRuntimeService
  path?: string
}

interface PublicRuntimeWebSocketPlaygroundProps {
  service: PublicRuntimeWebSocketService
  path?: string
  defaultMessage?: string
  authQueryKey?: string
  maxLogs?: number
  className?: string
}

function resolvePublicRuntimeServiceUrl(service: PublicRuntimeService, path = '') {
  const config = resolvePublicRuntimeEnv(process.env)
  return `${publicRuntimeServiceUrlSelectors[service](config)}${path}`
}

export function PublicRuntimeServiceUrl({
  service,
  path,
}: PublicRuntimeServiceUrlProps) {
  return <>{resolvePublicRuntimeServiceUrl(service, path)}</>
}

export function PublicRuntimeWebSocketPlayground({
  service,
  path,
  defaultMessage,
  authQueryKey,
  maxLogs,
  className,
}: PublicRuntimeWebSocketPlaygroundProps) {
  return (
    <WebSocketPlayground
      endpoint={resolvePublicRuntimeServiceUrl(service, path)}
      defaultMessage={defaultMessage}
      authQueryKey={authQueryKey}
      maxLogs={maxLogs}
      className={className}
    />
  )
}
