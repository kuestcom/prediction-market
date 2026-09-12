import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@supabase/supabase-js'
import { S3Client } from 'bun'
import 'server-only'

import type { S3StorageConfig } from '@/lib/storage'

import { ASSETS_BUCKET, normalizeAssetPath, resolveStorageRuntimeConfig } from '@/lib/storage'

type UploadBody = ArrayBuffer | Uint8Array | string

export interface UploadPublicAssetOptions {
  contentType: string
  cacheControl?: string
  upsert?: boolean
  timeoutMs?: number
}

const globalForStorageUpload = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined
  s3Client: S3Client | undefined
  s3ClientKey: string | undefined
}

function createSupabaseAdmin(timeoutMs?: number): SupabaseClient {
  const config = resolveStorageRuntimeConfig()
  if (config.provider !== 'supabase' || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or use S3-compatible storage variables.',
    )
  }

  if (!timeoutMs) {
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    global: {
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
        const timeoutSignal = AbortSignal.timeout(timeoutMs)
        const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal
        return fetch(input, { ...init, signal })
      }) as typeof fetch,
    },
  })
}

function getSupabaseAdmin(timeoutMs?: number): SupabaseClient {
  if (timeoutMs) {
    return createSupabaseAdmin(timeoutMs)
  }

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
    config.secretAccessKey,
    config.publicUrl ?? '',
    config.forcePathStyle ? '1' : '0',
  ].join('|')
}

function buildS3ClientEndpoint(config: S3StorageConfig) {
  if (!config.endpoint || config.forcePathStyle) {
    return config.endpoint ?? undefined
  }

  const endpoint = new URL(config.endpoint)
  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`
  return endpoint.toString().replace(/\/$/, '')
}

function getS3Client(config: S3StorageConfig): S3Client {
  const nextClientKey = buildS3ClientKey(config)
  if (!globalForStorageUpload.s3Client || globalForStorageUpload.s3ClientKey !== nextClientKey) {
    globalForStorageUpload.s3Client = new S3Client({
      region: config.region,
      bucket: config.bucket,
      endpoint: buildS3ClientEndpoint(config),
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      virtualHostedStyle: Boolean(config.endpoint && !config.forcePathStyle),
    })
    globalForStorageUpload.s3ClientKey = nextClientKey
  }

  return globalForStorageUpload.s3Client
}

function normalizeS3Body(body: UploadBody): string | ArrayBuffer {
  if (typeof body === 'string') {
    return body
  }

  if (body instanceof ArrayBuffer) {
    return body
  }

  return Uint8Array.from(body).buffer
}

export async function uploadPublicAsset(assetPath: string, body: UploadBody, options: UploadPublicAssetOptions) {
  const normalizedPath = normalizeAssetPath(assetPath)
  const config = resolveStorageRuntimeConfig()
  const timeoutSignal = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined

  if (config.provider === 'supabase') {
    const { error } = await getSupabaseAdmin(options.timeoutMs)
      .storage.from(ASSETS_BUCKET)
      .upload(normalizedPath, body, {
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
      const uploadUrl = client.presign(normalizedPath, {
        method: 'PUT',
        expiresIn: 3600,
      })
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': options.contentType,
          ...(options.cacheControl ? { 'Cache-Control': options.cacheControl } : {}),
          ...(shouldUpsert ? {} : { 'If-None-Match': '*' }),
        },
        body: normalizeS3Body(body),
        signal: timeoutSignal,
      })

      if (!response.ok) {
        return { error: `S3 upload failed: HTTP ${response.status} ${response.statusText}`.trim() }
      }

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
