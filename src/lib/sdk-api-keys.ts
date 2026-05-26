export const SDK_API_KEY_NONCE = '100'

type SdkApiKeyNonce = typeof SDK_API_KEY_NONCE

export type SdkApiKeyService = 'clob' | 'relayer'

export interface SdkApiKeyCredential {
  key: string
  secret: string
  passphrase: string
}

export interface SdkApiKeyBundle {
  nonce: SdkApiKeyNonce
  address: string
  clob?: SdkApiKeyCredential
  relayer?: SdkApiKeyCredential
}

export interface SdkApiKeyActionPayload {
  address: string
  signature: string
  timestamp: string
  nonce: SdkApiKeyNonce
}

export interface SdkApiKeyActionResult {
  error: string | null
  warning?: string | null
  data: SdkApiKeyBundle | null
}

export interface SdkApiKeyRevokeResult {
  error: string | null
  warning?: string | null
  data: {
    nonce: SdkApiKeyNonce
    revoked: Partial<Record<SdkApiKeyService, boolean>>
  } | null
}

export function buildClobSdkEnvBlock(address: string, credential: SdkApiKeyCredential) {
  return [
    `KUEST_ADDRESS=${address}`,
    `KUEST_API_KEY=${credential.key}`,
    `KUEST_API_SECRET=${credential.secret}`,
    `KUEST_PASSPHRASE=${credential.passphrase}`,
  ].join('\n')
}

export function buildRelayerBuilderSdkEnvBlock(credential: SdkApiKeyCredential) {
  return [
    `KUEST_BUILDER_API_KEY=${credential.key}`,
    `KUEST_BUILDER_SECRET=${credential.secret}`,
    `KUEST_BUILDER_PASSPHRASE=${credential.passphrase}`,
  ].join('\n')
}

export function hasSdkApiKeyCredentials(bundle: SdkApiKeyBundle | null | undefined) {
  return Boolean(bundle?.clob || bundle?.relayer)
}
