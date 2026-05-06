import type { DepositWalletStatus, MarketOrderType, User } from '@/types'
import { asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { affiliate_referrals } from '@/lib/db/schema/affiliates/tables'
import { accounts, sessions, two_factors, users, verifications, wallets } from '@/lib/db/schema/auth/tables'
import { orders } from '@/lib/db/schema/orders/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { isDepositWalletDeployed } from '@/lib/deposit-wallet'
import { db } from '@/lib/drizzle'
import { getPublicAssetUrl } from '@/lib/storage'
import { sanitizeTradingAuthSettings } from '@/lib/trading-auth/utils'
import { normalizeAddress } from '@/lib/wallet'

export const UserRepository = {
  async getProfileByUsernameOrDepositWalletAddress(username: string) {
    return await runQuery(async () => {
      const normalizedUsername = username.toLowerCase()
      const result = await db
        .select({
          id: users.id,
          deposit_wallet_address: users.deposit_wallet_address,
          username: users.username,
          image: users.image,
          created_at: users.created_at,
        })
        .from(users)
        .where(or(
          eq(sql`LOWER(${users.username})`, normalizedUsername),
          eq(sql`LOWER(${users.deposit_wallet_address})`, normalizedUsername),
        ))
        .limit(1)

      const rawData = result[0] || null

      if (!rawData) {
        return { data: null, error: null }
      }

      const data = {
        id: rawData.id,
        deposit_wallet_address: rawData.deposit_wallet_address,
        username: rawData.username!,
        image: rawData.image ? getPublicAssetUrl(rawData.image) : '',
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
        const cause = error.cause?.toString() ?? error.toString()

        if (cause.includes('idx_users_email') || cause.includes('users_email_unique')) {
          return { data: null, error: 'Email is already taken.' }
        }

        if (cause.includes('idx_users_username') || cause.includes('users_username_unique')) {
          return { data: null, error: 'Username is already taken.' }
        }

        return { data: null, error: 'Failed to update user.' }
      }
    })
  },

  async updateUserNotificationSettings(currentUser: User, preferences: any) {
    return await runQuery(async () => {
      const preferencesJson = JSON.stringify(preferences ?? {})

      const result = await db
        .update(users)
        .set({
          settings: sql`
            jsonb_set(
              CASE
                WHEN jsonb_typeof(coalesce(${users.settings}, '{}'::jsonb)) = 'object'
                  THEN coalesce(${users.settings}, '{}'::jsonb)
                ELSE '{}'::jsonb
              END,
              '{notifications}',
              ${preferencesJson}::jsonb,
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
      const normalizedSettings = sql`
        CASE
          WHEN jsonb_typeof(coalesce(${users.settings}, '{}'::jsonb)) = 'object'
            THEN coalesce(${users.settings}, '{}'::jsonb)
          ELSE '{}'::jsonb
        END
      `

      const result = await db
        .update(users)
        .set({
          settings: sql`
            jsonb_set(
              ${normalizedSettings},
              '{trading}',
              (
                CASE
                  WHEN jsonb_typeof(${normalizedSettings}->'trading') = 'object'
                    THEN ${normalizedSettings}->'trading'
                  ELSE '{}'::jsonb
                END
                || jsonb_build_object('market_order_type', to_jsonb(${marketOrderType}::text))
              ),
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

  async deleteUserAccountById(userId: string) {
    return await runQuery(async () => {
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ affiliate_user_id: null })
          .where(eq(orders.affiliate_user_id, userId))

        await tx.delete(orders).where(eq(orders.user_id, userId))
        await tx
          .delete(affiliate_referrals)
          .where(or(
            eq(affiliate_referrals.user_id, userId),
            eq(affiliate_referrals.affiliate_user_id, userId),
          ))
        await tx.delete(two_factors).where(eq(two_factors.user_id, userId))
        await tx.delete(wallets).where(eq(wallets.user_id, userId))
        await tx.delete(accounts).where(eq(accounts.user_id, userId))
        await tx.delete(sessions).where(eq(sessions.user_id, userId))
        await tx.delete(verifications).where(eq(verifications.value, userId))
        await tx
          .update(users)
          .set({ referred_by_user_id: null })
          .where(eq(users.referred_by_user_id, userId))
        await tx.delete(users).where(eq(users.id, userId))
      })

      return { data: { id: userId }, error: null }
    })
  },

  async getCurrentUser({
    disableCookieCache = false,
    minimal = false,
  }: { disableCookieCache?: boolean, minimal?: boolean } = {}) {
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
      const rawEmail = typeof user.email === 'string' ? user.email : ''
      const shouldRedactEmail = Boolean(rawEmail && rawEmail.startsWith('0x') && rawEmail.split('@')[0].length === 42)

      user.email = shouldRedactEmail ? '' : rawEmail
      if (user.settings) {
        user.settings = sanitizeTradingAuthSettings(user.settings)
      }

      if (minimal) {
        return user
      }

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

      const proxyAddress = await ensureUserDepositWallet(user)

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
                ilike(users.deposit_wallet_address, `%${sanitizedSearchTerm}%`),
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
          deposit_wallet_address: users.deposit_wallet_address,
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
          deposit_wallet_address: users.deposit_wallet_address,
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
      const addressClauses = normalizedAddresses.map(addr => eq(sql`LOWER(${users.address})`, addr))
      const proxyClauses = normalizedAddresses.map(addr => eq(sql`LOWER(${users.deposit_wallet_address})`, addr))
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
          deposit_wallet_address: users.deposit_wallet_address,
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

async function ensureUserDepositWallet(user: any): Promise<string | null> {
  const hasProxyAddress = typeof user?.deposit_wallet_address === 'string' && user.deposit_wallet_address.startsWith('0x')
  if (!hasProxyAddress) {
    return null
  }

  try {
    const proxyAddress = user.deposit_wallet_address as `0x${string}`
    let nextStatus: DepositWalletStatus = (user.deposit_wallet_status as DepositWalletStatus | null) ?? 'not_started'
    const updates: Record<string, any> = {}

    const shouldCheckDeployment = user.deposit_wallet_status !== 'deployed'
    if (shouldCheckDeployment) {
      const deployed = await isDepositWalletDeployed(proxyAddress)
      if (deployed) {
        nextStatus = 'deployed'
      }
    }

    if (nextStatus !== user.deposit_wallet_status) {
      updates.deposit_wallet_status = nextStatus
      if (nextStatus === 'deployed') {
        updates.deposit_wallet_tx_hash = null
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id))
    }

    user.deposit_wallet_address = proxyAddress
    user.deposit_wallet_status = nextStatus
    if (nextStatus === 'deployed') {
      user.deposit_wallet_tx_hash = null
    }

    return proxyAddress
  }
  catch (error) {
    console.error('Failed to ensure Deposit Wallet metadata', error)
  }

  return null
}
