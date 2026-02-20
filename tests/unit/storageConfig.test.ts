import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_URL',
  'S3_FORCE_PATH_STYLE',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const

const ENV_SNAPSHOT = STORAGE_ENV_KEYS.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key]
  return acc
}, {})

function clearStorageEnv() {
  STORAGE_ENV_KEYS.forEach((key) => {
    delete process.env[key]
  })
}

async function loadStorageModule() {
  vi.resetModules()
  return await import('@/lib/storage')
}

describe('storage compatibility', () => {
  beforeEach(() => {
    clearStorageEnv()
    vi.resetModules()
  })

  afterEach(() => {
    STORAGE_ENV_KEYS.forEach((key) => {
      const snapshotValue = ENV_SNAPSHOT[key]
      if (snapshotValue === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = snapshotValue
      }
    })
    vi.resetModules()
  })

  it('uses Supabase public URL when Supabase env vars are configured', async () => {
    process.env.SUPABASE_URL = 'https://demo.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    const { getPublicAssetUrl } = await loadStorageModule()
    expect(getPublicAssetUrl('theme/logo.png')).toBe(
      'https://demo.supabase.co/storage/v1/object/public/kuest-assets/theme/logo.png',
    )
    expect(getPublicAssetUrl('https://cdn.example.com/direct.png')).toBe('https://cdn.example.com/direct.png')
  })

  it('uses S3 public URL when Supabase is not configured', async () => {
    process.env.S3_BUCKET = 'kuest-assets'
    process.env.S3_ENDPOINT = 'https://s3.example.com/'
    process.env.S3_ACCESS_KEY_ID = 's3-key'
    process.env.S3_SECRET_ACCESS_KEY = 's3-secret'

    const { getPublicAssetUrl } = await loadStorageModule()
    expect(getPublicAssetUrl('users/avatar.jpg')).toBe('https://s3.example.com/kuest-assets/users/avatar.jpg')
  })

  it('prefers S3_PUBLIC_URL as public base when provided', async () => {
    process.env.S3_BUCKET = 'kuest-assets'
    process.env.S3_ENDPOINT = 'https://s3.example.com'
    process.env.S3_ACCESS_KEY_ID = 's3-key'
    process.env.S3_SECRET_ACCESS_KEY = 's3-secret'
    process.env.S3_PUBLIC_URL = 'https://cdn.example.com/assets/'

    const { getPublicAssetUrl } = await loadStorageModule()
    expect(getPublicAssetUrl('users/avatar.jpg')).toBe('https://cdn.example.com/assets/users/avatar.jpg')
  })

  it('throws on partial Supabase configuration', async () => {
    process.env.SUPABASE_URL = 'https://demo.supabase.co'

    const { getPublicAssetUrl } = await loadStorageModule()
    expect(() => getPublicAssetUrl('users/avatar.jpg')).toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set together.',
    )
  })

  it('returns empty string for relative assets when no provider is configured', async () => {
    const { getPublicAssetUrl } = await loadStorageModule()
    expect(getPublicAssetUrl('users/avatar.jpg')).toBe('')
    expect(getPublicAssetUrl(null)).toBe('')
  })
})
