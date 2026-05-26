export type SdkApiKeyService = 'clob' | 'relayer'

export interface SdkApiKeyCredential {
  key: string
  secret: string
  passphrase: string
}

export interface SdkApiKeyBundle {
  nonce: string
  address: string
  clob?: SdkApiKeyCredential
  relayer?: SdkApiKeyCredential
}

export interface SdkApiKeyActionPayload {
  address: string
  signature: string
  timestamp: string
  nonce: string
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
    nonce: string
    revoked: Partial<Record<SdkApiKeyService, boolean>>
  } | null
}

export interface SdkApiKeyNextNonceResult {
  error: string | null
  nonce: string | null
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
