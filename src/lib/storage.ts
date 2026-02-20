import type { SupabaseClient } from '@supabase/supabase-js'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import 'server-only'

const ASSETS_BUCKET = 'kuest-assets'
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

export type StorageProvider = 'supabase' | 's3' | 'none'
type UploadBody = ArrayBuffer | Uint8Array | string

interface S3StorageConfig {
  endpoint: string | null
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl: string | null
  forcePathStyle: boolean
}

interface StorageRuntimeConfig {
  provider: StorageProvider
  supabaseUrl: string | null
  supabaseServiceRoleKey: string | null
  s3: S3StorageConfig | null
}

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined
  s3Client: S3Client | undefined
  s3ClientKey: string | undefined
}

export interface UploadPublicAssetOptions {
  contentType: string
  cacheControl?: string
  upsert?: boolean
}

function normalizeEnv(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

function parseBooleanEnv(value: string | null, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) {
    return true
  }
  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return fallback
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeAssetPath(value: string) {
  return value.replace(/^\/+/, '')
}

function resolveS3Config() {
  const endpoint = normalizeEnv(process.env.S3_ENDPOINT)
  const region = normalizeEnv(process.env.S3_REGION) ?? normalizeEnv(process.env.AWS_REGION) ?? 'us-east-1'
  const bucket = normalizeEnv(process.env.S3_BUCKET)
  const accessKeyId = normalizeEnv(process.env.S3_ACCESS_KEY_ID) ?? normalizeEnv(process.env.AWS_ACCESS_KEY_ID)
  const secretAccessKey = normalizeEnv(process.env.S3_SECRET_ACCESS_KEY) ?? normalizeEnv(process.env.AWS_SECRET_ACCESS_KEY)
  const publicUrl = normalizeEnv(process.env.S3_PUBLIC_URL)
  const forcePathStyleDefault = Boolean(endpoint)
  const forcePathStyle = parseBooleanEnv(normalizeEnv(process.env.S3_FORCE_PATH_STYLE), forcePathStyleDefault)

  const hasAny = Boolean(endpoint || bucket || accessKeyId || secretAccessKey || publicUrl)
  const missing: string[] = []

  if (!bucket) {
    missing.push('S3_BUCKET')
  }
  if (!accessKeyId) {
    missing.push('S3_ACCESS_KEY_ID')
  }
  if (!secretAccessKey) {
    missing.push('S3_SECRET_ACCESS_KEY')
  }

  let config: S3StorageConfig | null = null
  if (bucket && accessKeyId && secretAccessKey) {
    config = {
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicUrl,
      forcePathStyle,
    }
  }

  return { hasAny, missing, config }
}

function resolveStorageRuntimeConfig(): StorageRuntimeConfig {
  const supabaseUrl = normalizeEnv(process.env.SUPABASE_URL)
  const supabaseServiceRoleKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const hasAnySupabase = Boolean(supabaseUrl || supabaseServiceRoleKey)

  if (hasAnySupabase) {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set together.')
    }

    return {
      provider: 'supabase',
      supabaseUrl,
      supabaseServiceRoleKey,
      s3: null,
    }
  }

  const s3 = resolveS3Config()
  if (s3.hasAny) {
    if (s3.missing.length > 0) {
      throw new Error(`S3 configuration is incomplete. Missing env vars: ${s3.missing.join(', ')}`)
    }

    return {
      provider: 's3',
      supabaseUrl: null,
      supabaseServiceRoleKey: null,
      s3: s3.config,
    }
  }

  return {
    provider: 'none',
    supabaseUrl: null,
    supabaseServiceRoleKey: null,
    s3: null,
  }
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
  if (!globalForSupabase.supabaseAdmin) {
    globalForSupabase.supabaseAdmin = createSupabaseAdmin()
  }
  return globalForSupabase.supabaseAdmin
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
  if (!globalForSupabase.s3Client || globalForSupabase.s3ClientKey !== nextClientKey) {
    globalForSupabase.s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint ?? undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    globalForSupabase.s3ClientKey = nextClientKey
  }

  return globalForSupabase.s3Client
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

function buildS3PublicAssetBaseUrl(config: S3StorageConfig) {
  if (config.publicUrl) {
    return trimTrailingSlash(config.publicUrl)
  }

  if (!config.endpoint) {
    return trimTrailingSlash(`https://${config.bucket}.s3.${config.region}.amazonaws.com`)
  }

  const normalizedEndpoint = trimTrailingSlash(config.endpoint)
  if (config.forcePathStyle) {
    return `${normalizedEndpoint}/${config.bucket}`
  }

  try {
    const parsed = new URL(normalizedEndpoint)
    const normalizedPath = parsed.pathname && parsed.pathname !== '/'
      ? parsed.pathname.replace(/\/+$/, '')
      : ''
    return `${parsed.protocol}//${config.bucket}.${parsed.host}${normalizedPath}`
  }
  catch {
    return `${normalizedEndpoint}/${config.bucket}`
  }
}

export async function uploadPublicAsset(
  assetPath: string,
  body: UploadBody,
  options: UploadPublicAssetOptions,
) {
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
      await client.send(new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: normalizedPath,
        Body: normalizeS3Body(body),
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
      }))
      return { error: null }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { error: `S3 upload failed: ${message}` }
    }
  }

  return {
    error: 'Storage provider is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or S3_BUCKET + S3 credentials.',
  }
}

export function getPublicAssetUrl(assetPath: string | null): string {
  if (!assetPath) {
    return ''
  }

  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath
  }

  const normalizedPath = normalizeAssetPath(assetPath)
  const config = resolveStorageRuntimeConfig()

  if (config.provider === 'supabase' && config.supabaseUrl) {
    return `${config.supabaseUrl}/storage/v1/object/public/${ASSETS_BUCKET}/${normalizedPath}`
  }

  if (config.provider === 's3' && config.s3) {
    const baseUrl = buildS3PublicAssetBaseUrl(config.s3)
    return `${baseUrl}/${normalizedPath}`
  }

  return ''
}
