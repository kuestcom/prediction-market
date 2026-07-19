import type { IdentityProviderAdapter } from './types'
import { fakeIdentityProviderAdapter } from './fake'
import { genericWebhookAdapter } from './generic-webhook'

const adapters: Readonly<Record<string, IdentityProviderAdapter<any>>> = {
  [genericWebhookAdapter.key]: genericWebhookAdapter,
  ...(process.env.NODE_ENV === 'production' ? {} : { [fakeIdentityProviderAdapter.key]: fakeIdentityProviderAdapter }),
}

export function getIdentityProviderAdapter(key: string): IdentityProviderAdapter<any> {
  const adapter = adapters[key]
  if (!adapter) {
    throw new Error('IDENTITY_PROVIDER_ADAPTER_UNSUPPORTED')
  }
  return adapter
}
