import type { PublicRuntimeConfig } from '@/lib/public-runtime-config'
import { serializePublicRuntimeConfig } from '@/lib/public-runtime-config'

interface PublicRuntimeConfigScriptProps {
  config: PublicRuntimeConfig
}

export default function PublicRuntimeConfigScript({ config }: PublicRuntimeConfigScriptProps) {
  const script = `window.__PUBLIC_RUNTIME_CONFIG__=${serializePublicRuntimeConfig(config)};`

  return (
    <script
      id="kuest-public-runtime-config"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  )
}
