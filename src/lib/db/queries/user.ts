import type { MarketOrderType, ProxyWalletStatus, User } from '@/types'
import { asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { users } from '@/lib/db/schema/auth/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import { getSafeProxyWalletAddress, isProxyWalletDeployed } from '@/lib/safe-proxy'
import { getSupabaseImageUrl } from '@/lib/supabase'
import { sanitizeTradingAuthSettings } from '@/lib/trading-auth/utils'
import { normalizeAddress } from '@/lib/wallet'

export const UserRepository = {
  async getProfileByUsernameOrProxyAddress(username: string) {
    return await runQuery(async () => {
      const normalizedUsername = username.toLowerCase()
      const result = await db
        .select({
          id: users.id,
          proxy_wallet_address: users.proxy_wallet_address,
          username: users.username,
          image: users.image,
          created_at: users.created_at,
        })
        .from(users)
        .where(or(
          eq(sql`LOWER(${users.username})`, normalizedUsername),
          eq(sql`LOWER(${users.proxy_wallet_address})`, normalizedUsername),
        ))
        .limit(1)

      const rawData = result[0] || null

      if (!rawData) {
        return { data: null, error: null }
      }

      const data = {
        id: rawData.id,
        proxy_wallet_address: rawData.proxy_wallet_address,
        username: rawData.username!,
        image: rawData.image ? getSupabaseImageUrl(rawData.image) : '',
        created_at: rawData.created_at,
      }

      return { data, error: null }
    })
  },

  async updateUserProfileById(userId: string, input: any) {
    return runQuery(async () => {
      try {
        const result = await db
          .update(users)
          .set(input)
          .where(eq(users.id, userId))
          .returning()

        const data = result[0] as typeof users.$inferSelect | undefined

        if (!data) {
          return { data: null, error: 'User not found.' }
        }

        return { data: data!, error: null }
      }
      catch (error: any) {
        if (error.cause?.toString().includes('idx_users_email')) {
          return { data: null, error: 'Email is already taken.' }
        }

        if (error.cause?.toString().includes('idx_users_username')) {
          return { data: null, error: 'Username is already taken.' }
        }

        return { data: null, error: 'Failed to update user.' }
      }
    })
  },

  async updateUserNotificationSettings(currentUser: User, preferences: any) {
    return await runQuery(async () => {
      const result = await db
        .update(users)
        .set({
          settings: sql`
            jsonb_set(
              coalesce(${users.settings}, '{}'::jsonb),
              '{notifications}',
              (${preferences}::jsonb),
              true
            )
          `,
        })
        .where(eq(users.id, currentUser.id))
        .returning({ id: users.id })

      const data = result[0] || null

      if (!data) {
        return { data: null, error: DEFAULT_ERROR_MESSAGE }
      }

      return { data, error: null }
    })
  },

  async updateUserTradingSettings(currentUser: User, preferences: { market_order_type: MarketOrderType }) {
    return await runQuery(async () => {
      const marketOrderType = preferences.market_order_type

      const result = await db
        .update(users)
        .set({
          settings: sql`
            jsonb_set(
              coalesce(${users.settings}, '{}'::jsonb),
              '{trading,market_order_type}',
              to_jsonb(${marketOrderType}::text),
              true
            )
          `,
        })
        .where(eq(users.id, currentUser.id))
        .returning({ id: users.id })

      const data = result[0] || null

      if (!data) {
        return { data: null, error: DEFAULT_ERROR_MESSAGE }
      }

      return { data, error: null }
    })
  },

  async getCurrentUser({ disableCookieCache = false }: { disableCookieCache?: boolean } = {}) {
    try {
      const session = await auth.api.getSession({
        query: {
          disableCookieCache,
        },
        headers: await headers(),
      })

      if (!session?.user) {
        return null
      }

      const user: any = session.user
      const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL
      const rawEmail = typeof user.email === 'string' ? user.email : ''
      const shouldRedactEmail = Boolean(
        rawEmail
        && (
          (productionDomain && rawEmail.includes(productionDomain))
          || rawEmail.includes('vercel.app')
        ),
      )

      user.email = shouldRedactEmail ? '' : rawEmail

      if (!user.affiliate_code) {
        try {
          const { data: code } = await AffiliateRepository.ensureUserAffiliateCode(user.id)
          if (code) {
            user.affiliate_code = code
          }
        }
        catch (error) {
          console.error('Failed to ensure affiliate code', error)
        }
      }

      const proxyAddress = await ensureUserProxyWallet(user)

      if (user.settings) {
        user.settings = sanitizeTradingAuthSettings(user.settings)
      }

      if (proxyAddress && !user.username) {
        const generatedUsername = generateUsername(proxyAddress)

        if (generatedUsername) {
          try {
            const result = await db
              .update(users)
              .set({ username: generatedUsername })
              .where(eq(users.id, user.id))
              .returning({ username: users.username })

            const updatedUsername = result[0]?.username
            if (updatedUsername) {
              user.username = updatedUsername
            }
          }
          catch (error) {
            console.error('Failed to set deterministic username', error)
          }
        }
      }

      return user
    }
    catch {
      return null
    }
  },

  async listUsers(params: {
    limit?: number
    offset?: number
    search?: string
    sortBy?: 'username' | 'email' | 'address' | 'created_at'
    sortOrder?: 'asc' | 'desc'
    searchByUsernameOnly?: boolean
  } = {}) {
    'use cache'

    const { data, error } = await runQuery(async () => {
      const {
        limit: rawLimit = 100,
        offset = 0,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc',
        searchByUsernameOnly = false,
      } = params

      const limit = Math.min(Math.max(rawLimit, 1), 1000)

      let whereCondition
      if (search && search.trim()) {
        const searchTerm = search.trim()
        const sanitizedSearchTerm = searchTerm
          .replace(/[,()]/g, ' ')
          .replace(/['"]/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        if (sanitizedSearchTerm) {
          const usernameCondition = ilike(users.username, `%${sanitizedSearchTerm}%`)
          whereCondition = searchByUsernameOnly
            ? usernameCondition
            : or(
                usernameCondition,
                ilike(users.email, `%${sanitizedSearchTerm}%`),
                ilike(users.address, `%${sanitizedSearchTerm}%`),
                ilike(users.proxy_wallet_address, `%${sanitizedSearchTerm}%`),
              )
        }
      }

      let orderByClause
      if (sortBy === 'username') {
        const sortDirection = sortOrder === 'asc' ? asc : desc
        orderByClause = [sortDirection(users.username), sortDirection(users.address)]
      }
      else {
        let sortColumn
        switch (sortBy) {
          case 'email':
            sortColumn = users.email
            break
          case 'address':
            sortColumn = users.address
            break
          case 'created_at':
            sortColumn = users.created_at
            break
          default:
            sortColumn = users.created_at
        }
        const sortDirection = sortOrder === 'asc' ? asc : desc
        orderByClause = [sortDirection(sortColumn)]
      }

      const queryBuilder = db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          address: users.address,
          proxy_wallet_address: users.proxy_wallet_address,
          created_at: users.created_at,
          image: users.image,
          affiliate_code: users.affiliate_code,
          referred_by_user_id: users.referred_by_user_id,
        })
        .from(users)

      const rows = await (whereCondition
        ? queryBuilder.where(whereCondition).orderBy(...orderByClause).limit(limit).offset(offset)
        : queryBuilder.orderBy(...orderByClause).limit(limit).offset(offset))

      const countQueryBuilder = db
        .select({ count: count() })
        .from(users)

      const countResult = await (whereCondition
        ? countQueryBuilder.where(whereCondition)
        : countQueryBuilder)
      const totalCount = countResult[0]?.count || 0

      return { data: { users: rows, count: totalCount }, error: null }
    })

    if (!data || error) {
      return { data: null, error: error || DEFAULT_ERROR_MESSAGE, count: 0 }
    }

    return { data: data.users, error: null, count: data.count }
  },

  async getUsersByIds(ids: string[]) {
    if (!ids.length) {
      return { data: [], error: null }
    }

    return await runQuery(async () => {
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          address: users.address,
          proxy_wallet_address: users.proxy_wallet_address,
          image: users.image,
          created_at: users.created_at,
        })
        .from(users)
        .where(inArray(users.id, ids))

      return { data: result, error: null }
    })
  },

  async getUsersByAddresses(addresses: string[]) {
    const normalizedAddresses = Array.from(new Set(
      (addresses || [])
        .map(address => normalizeAddress(address)?.toLowerCase())
        .filter(Boolean) as string[],
    ))

    if (!normalizedAddresses.length) {
      return { data: [], error: null }
    }

    return await runQuery(async () => {
      const addressClauses = normalizedAddresses.map(addr => ilike(users.address, addr))
      const proxyClauses = normalizedAddresses.map(addr => ilike(users.proxy_wallet_address, addr))
      const whereConditions = [...addressClauses, ...proxyClauses].filter(Boolean)
      const whereClause = whereConditions.length > 1
        ? or(...whereConditions)
        : whereConditions[0]

      if (!whereClause) {
        return { data: [], error: null }
      }

      const result = await db
        .select({
          id: users.id,
          username: users.username,
          address: users.address,
          proxy_wallet_address: users.proxy_wallet_address,
          image: users.image,
          created_at: users.created_at,
        })
        .from(users)
        .where(whereClause)

      return { data: result, error: null }
    })
  },
}

function generateUsername(proxyAddress: string) {
  const timestamp = Date.now()

  return `${proxyAddress}-${timestamp}`
}

async function ensureUserProxyWallet(user: any): Promise<string | null> {
  const owner = typeof user?.address === 'string' ? user.address : ''
  if (!owner || !owner.startsWith('0x')) {
    return null
  }

  const hasProxyAddress = typeof user?.proxy_wallet_address === 'string' && user.proxy_wallet_address.startsWith('0x')

  try {
    const expectedProxyAddress = await getSafeProxyWalletAddress(owner as `0x${string}`)

    if (!expectedProxyAddress) {
      return null
    }

    const normalizedExpected = expectedProxyAddress.toLowerCase()
    const normalizedCurrent = hasProxyAddress ? user.proxy_wallet_address.toLowerCase() : null
    const addressChanged = !normalizedCurrent || normalizedCurrent !== normalizedExpected
    const proxyAddress = addressChanged
      ? expectedProxyAddress
      : (user.proxy_wallet_address as `0x${string}`)

    let nextStatus: ProxyWalletStatus = (user.proxy_wallet_status as ProxyWalletStatus | null) ?? 'not_started'
    const updates: Record<string, any> = {}

    if (addressChanged) {
      updates.proxy_wallet_address = proxyAddress
    }

    const shouldCheckDeployment = addressChanged
      || !hasProxyAddress
      || user.proxy_wallet_status !== 'deployed'
    if (shouldCheckDeployment) {
      const deployed = await isProxyWalletDeployed(proxyAddress as `0x${string}`)
      if (deployed) {
        nextStatus = 'deployed'
      }
    }

    if (nextStatus !== user.proxy_wallet_status) {
      updates.proxy_wallet_status = nextStatus
      if (nextStatus === 'deployed') {
        updates.proxy_wallet_tx_hash = null
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id))
    }

    user.proxy_wallet_address = proxyAddress
    user.proxy_wallet_status = nextStatus
    if (nextStatus === 'deployed') {
      user.proxy_wallet_tx_hash = null
    }

    return proxyAddress
  }
  catch (error) {
    console.error('Failed to ensure proxy wallet metadata', error)
  }

  return null
}
