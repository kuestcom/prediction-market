import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import 'server-only'

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined
}

function createSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Configure env vars to use Supabase.')
  }

  return createClient(supabaseUrl, serviceKey)
}

function getSupabaseAdmin(): SupabaseClient {
  if (!globalForSupabase.supabaseAdmin) {
    globalForSupabase.supabaseAdmin = createSupabaseAdmin()
  }
  return globalForSupabase.supabaseAdmin
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (prop === 'then') {
      return undefined
    }
    const client = getSupabaseAdmin()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
}) as SupabaseClient

export function getSupabasePublicAssetUrl(assetPath: string | null): string | null {
  const supabaseUrl = process.env.SUPABASE_URL

  if (!assetPath || !supabaseUrl) {
    return null
  }

  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath
  }

  return `${supabaseUrl}/storage/v1/object/public/kuest-assets/${assetPath}`
}

export function getSupabaseImageUrl(iconPath: string | null): string {
  const publicUrl = getSupabasePublicAssetUrl(iconPath)
  if (!publicUrl) {
    return 'https://avatar.vercel.sh/creator.png'
  }

  return publicUrl
}
