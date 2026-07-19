import type { IdentityProgramVersionInput } from './types'
import { and, eq } from 'drizzle-orm'
import { identity_provider_configs } from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { getIdentityCurrentEncryptionKeyId } from './encryption'
import { getIdentityProviderAdapter } from './providers/registry'
import { IdentityAssignmentRulesSchema } from './schemas'
import 'server-only'

export async function assertIdentityActivationReady(programs: readonly IdentityProgramVersionInput[]) {
  if (programs.length === 0) {
    throw new Error('IDENTITY_PUBLISHED_PROGRAM_REQUIRED')
  }

  void getIdentityCurrentEncryptionKeyId()
  if (!process.env.IDENTITY_PRIVATE_BUCKET?.trim()) {
    throw new Error('IDENTITY_PRIVATE_STORAGE_NOT_CONFIGURED')
  }
  if (programs.some(program => program.fields.some(field => (
    ['file', 'document'].includes(field.type) && field.storageMode === 'local_encrypted'
  ))) && !process.env.IDENTITY_DOCUMENT_SCANNER_URL?.trim()) {
    throw new Error('IDENTITY_DOCUMENT_SCANNER_NOT_CONFIGURED')
  }

  for (const program of programs) {
    const assignment = IdentityAssignmentRulesSchema.parse(program.assignmentRules)
    if (!assignment.consent) {
      throw new Error('IDENTITY_CONSENT_REQUIRED')
    }
    if (program.mode === 'self_hosted') {
      continue
    }
    if (!assignment.providerConfigId) {
      throw new Error('IDENTITY_PROVIDER_REQUIRED')
    }

    for (const providerId of [assignment.providerConfigId, ...assignment.fallbackProviderConfigIds]) {
      const [provider] = await db.select().from(identity_provider_configs).where(and(
        eq(identity_provider_configs.id, providerId),
        eq(identity_provider_configs.enabled, true),
      )).limit(1)
      if (!provider?.encrypted_secret) {
        throw new Error('IDENTITY_PROVIDER_NOT_AVAILABLE')
      }
      const adapter = getIdentityProviderAdapter(provider.adapter)
      const config = adapter.validateConfig(provider.public_config, provider.environment as 'sandbox' | 'production')
      const providerMetadata = config as Record<string, unknown>
      if (!Array.isArray(providerMetadata.supportedCountries)
        || typeof providerMetadata.processingRegion !== 'string'
        || typeof providerMetadata.storageRegion !== 'string'
        || typeof providerMetadata.retentionDays !== 'number'
        || !Array.isArray(providerMetadata.subprocessors)
        || typeof providerMetadata.serviceLevel !== 'string'
        || typeof providerMetadata.contractDocumentationUrl !== 'string') {
        throw new TypeError('IDENTITY_PROVIDER_GOVERNANCE_METADATA_REQUIRED')
      }
      if (assignment.countries.some(country => !(providerMetadata.supportedCountries as string[]).includes(country))) {
        throw new Error('IDENTITY_PROVIDER_COUNTRY_UNSUPPORTED')
      }
      if (!adapter.capabilities.deletion || !adapter.deleteCase || !('deletionUrl' in config)) {
        throw new Error('IDENTITY_PROVIDER_ERASURE_UNSUPPORTED')
      }
      const health = await adapter.healthCheck(config)
      if (!health.healthy) {
        throw new Error('IDENTITY_PROVIDER_HEALTH_CHECK_FAILED')
      }
    }
  }
}
