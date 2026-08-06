import type { SupabaseClient } from '@supabase/supabase-js'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import 'server-only'

import type { S3StorageConfig } from '@/lib/storage'

import { ASSETS_BUCKET, normalizeAssetPath, resolveStorageRuntimeConfig } from '@/lib/storage'

type UploadBody = ArrayBuffer | Uint8Array | string

export interface UploadPublicAssetOptions {
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

const globalForStorageUpload = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined
  s3Client: S3Client | undefined
  s3ClientKey: string | undefined
}

function createSupabaseAdmin(): SupabaseClient {
  const config = resolveStorageRuntimeConfig()
  if (config.provider !== 'supabase' || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or use S3-compatible storage variables.',
    )
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
}

function getSupabaseAdmin(): SupabaseClient {
  if (!globalForStorageUpload.supabaseAdmin) {
    globalForStorageUpload.supabaseAdmin = createSupabaseAdmin()
  }
  return globalForStorageUpload.supabaseAdmin
}

function buildS3ClientKey(config: S3StorageConfig) {
  return [
    config.endpoint ?? '',
    config.region,
    config.bucket,
    config.accessKeyId,
    config.publicUrl ?? '',
    config.forcePathStyle ? '1' : '0',
  ].join('|')
}

function getS3Client(config: S3StorageConfig): S3Client {
  const nextClientKey = buildS3ClientKey(config)
  if (!globalForStorageUpload.s3Client || globalForStorageUpload.s3ClientKey !== nextClientKey) {
    globalForStorageUpload.s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint ?? undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    globalForStorageUpload.s3ClientKey = nextClientKey
  }

  return globalForStorageUpload.s3Client
}

function normalizeS3Body(body: UploadBody) {
  if (typeof body === 'string') {
    return body
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }

  return body
}

export async function uploadPublicAsset(assetPath: string, body: UploadBody, options: UploadPublicAssetOptions) {
  const normalizedPath = normalizeAssetPath(assetPath)
  const config = resolveStorageRuntimeConfig()

  if (config.provider === 'supabase') {
    const { error } = await getSupabaseAdmin().storage.from(ASSETS_BUCKET).upload(normalizedPath, body, {
      contentType: options.contentType,
      cacheControl: options.cacheControl,
      upsert: options.upsert,
    })

    return { error: error?.message ?? null }
  }

  if (config.provider === 's3' && config.s3) {
    try {
      const client = getS3Client(config.s3)
      const shouldUpsert = options.upsert === true
      await client.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: normalizedPath,
          Body: normalizeS3Body(body),
          ContentType: options.contentType,
          CacheControl: options.cacheControl,
          IfNoneMatch: shouldUpsert ? undefined : '*',
        }),
      )
      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { error: `S3 upload failed: ${message}` }
    }
  }

  return {
    error:
      'Storage provider is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or S3_BUCKET + S3 credentials.',
  }
}
