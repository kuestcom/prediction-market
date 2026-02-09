import type { QueryResult } from '@/types'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { affiliate_referrals } from '@/lib/db/schema/affiliates/tables'
import { users } from '@/lib/db/schema/auth/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

const AFFILIATE_CODE_BYTES = 4
const AFFILIATE_VOLUME_DECIMALS = 6
const AFFILIATE_VOLUME_SCALE = 10 ** AFFILIATE_VOLUME_DECIMALS

interface AffiliateUser {
  id: string
  affiliate_code: string | null
  username: string
  address: string
  image: string | null
}

interface ReferralData {
  user_id: string
  affiliate_user_id: string
  created_at: Date
  affiliate_user: {
    address: string
  }
}

interface ReferralArgs {
  user_id: string
  affiliate_user_id: string
}

interface ReferralRecord {
  user_id: string
  affiliate_user_id: string
  created_at: Date
}

interface AffiliateStats {
  total_referrals: number
  active_referrals: number
  volume: number
}

interface AffiliateOverview {
  affiliate_user_id: string
  total_referrals: number
  volume: number
}

interface AffiliateProfile {
  id: string
  username: string
  address: string
  proxy_wallet_address: string | null
  image: string | null
  affiliate_code: string | null
}

interface ReferralList {
  user_id: string
  created_at: Date
  users: {
    username: string
    address: string
    proxy_wallet_address: string | null
    image: string | null
  }
}

function convertToNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0
  }
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

function convertAffiliateVolume(value: any): number {
  return convertToNumber(value) / AFFILIATE_VOLUME_SCALE
}

function convertAffiliateStats(rawData: any): AffiliateStats {
  return {
    total_referrals: convertToNumber(rawData.total_referrals),
    active_referrals: convertToNumber(rawData.active_referrals),
    volume: convertAffiliateVolume(rawData.volume),
  }
}

function convertAffiliateOverview(rawData: any[]): AffiliateOverview[] {
  return rawData.map(item => ({
    affiliate_user_id: item.affiliate_user_id,
    total_referrals: convertToNumber(item.total_referrals),
    volume: convertAffiliateVolume(item.volume),
  }))
}

function generateAffiliateCode(): string {
  return randomBytes(AFFILIATE_CODE_BYTES).toString('hex')
}

async function generateUniqueAffiliateCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generateAffiliateCode()

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.affiliate_code, candidate))
      .limit(1)

    if (existing.length === 0) {
      return candidate
    }
  }

  throw new Error('Failed to generate unique affiliate code')
}

export const AffiliateRepository = {
  async ensureUserAffiliateCode(userId: string): Promise<QueryResult<string>> {
    return runQuery(async () => {
      const existingUser = await db
        .select({ affiliate_code: users.affiliate_code })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (existingUser.length === 0) {
        return { data: null, error: 'User not found' }
      }

      const user = existingUser[0]

      if (user.affiliate_code) {
        return { data: user.affiliate_code, error: null }
      }

      let code: string
      try {
        code = await generateUniqueAffiliateCode()
      }
      catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate affiliate code'
        return { data: null, error: message }
      }

      const updatedUser = await db
        .update(users)
        .set({ affiliate_code: code })
        .where(eq(users.id, userId))
        .returning({ affiliate_code: users.affiliate_code })

      if (updatedUser.length === 0) {
        return { data: null, error: 'Failed to update user with affiliate code' }
      }

      return { data: updatedUser[0].affiliate_code!, error: null }
    })
  },

  async getAffiliateByCode(code: string): Promise<QueryResult<AffiliateUser | null>> {
    'use cache'

    return runQuery(async () => {
      const result = await db
        .select({
          id: users.id,
          affiliate_code: users.affiliate_code,
          username: users.username,
          address: users.address,
          image: users.image,
        })
        .from(users)
        .where(eq(users.affiliate_code, code))
        .limit(1)

      return {
        data: result.length > 0
          ? {
              id: result[0].id,
              affiliate_code: result[0].affiliate_code,
              username: result[0].username!,
              address: result[0].address,
              image: result[0].image,
            }
          : null,
        error: null,
      }
    })
  },

  async getReferral(userId: string): Promise<QueryResult<ReferralData | null>> {
    'use cache'

    return runQuery(async () => {
      const result = await db
        .select({
          user_id: affiliate_referrals.user_id,
          affiliate_user_id: affiliate_referrals.affiliate_user_id,
          created_at: affiliate_referrals.created_at,
          affiliate_user_address: users.address,
        })
        .from(affiliate_referrals)
        .innerJoin(users, eq(affiliate_referrals.affiliate_user_id, users.id))
        .where(eq(affiliate_referrals.user_id, userId))
        .limit(1)

      if (result.length === 0) {
        return { data: null, error: null }
      }

      const row = result[0]
      const data = {
        user_id: row.user_id,
        affiliate_user_id: row.affiliate_user_id,
        created_at: row.created_at,
        affiliate_user: {
          address: row.affiliate_user_address,
        },
      }

      return { data, error: null }
    })
  },

  async recordReferral(args: ReferralArgs): Promise<QueryResult<ReferralRecord>> {
    return runQuery(async () => {
      if (args.user_id === args.affiliate_user_id) {
        return { data: null, error: 'Self referrals are not allowed.' }
      }

      const existingReferral = await db
        .select({
          affiliate_user_id: affiliate_referrals.affiliate_user_id,
          user_id: affiliate_referrals.user_id,
          created_at: affiliate_referrals.created_at,
        })
        .from(affiliate_referrals)
        .where(eq(affiliate_referrals.user_id, args.user_id))
        .limit(1)

      if (existingReferral.length > 0 && existingReferral[0].affiliate_user_id === args.affiliate_user_id) {
        return {
          data: {
            user_id: existingReferral[0].user_id,
            affiliate_user_id: existingReferral[0].affiliate_user_id,
            created_at: existingReferral[0].created_at,
          },
          error: null,
        }
      }

      const upsertResult = await db
        .insert(affiliate_referrals)
        .values({
          user_id: args.user_id,
          affiliate_user_id: args.affiliate_user_id,
        })
        .onConflictDoUpdate({
          target: affiliate_referrals.user_id,
          set: {
            affiliate_user_id: args.affiliate_user_id,
          },
        })
        .returning({
          user_id: affiliate_referrals.user_id,
          affiliate_user_id: affiliate_referrals.affiliate_user_id,
          created_at: affiliate_referrals.created_at,
        })

      if (upsertResult.length === 0) {
        return { data: null, error: 'Failed to create or update referral record' }
      }

      const referralRecord = upsertResult[0]

      await db
        .update(users)
        .set({ referred_by_user_id: args.affiliate_user_id })
        .where(
          and(
            eq(users.id, args.user_id),
            isNull(users.referred_by_user_id),
          ),
        )

      return { data: referralRecord, error: null }
    })
  },

  async getUserAffiliateStats(userId: string): Promise<QueryResult<AffiliateStats>> {
    'use cache'

    return runQuery(async () => {
      const result = await db.execute(
        sql`SELECT * FROM get_affiliate_stats(${userId})`,
      )

      if (!result || result.length === 0) {
        const fallback = {
          total_referrals: 0,
          active_referrals: 0,
          volume: 0,
        }
        return { data: fallback, error: null }
      }

      const rawData = result[0]
      return { data: convertAffiliateStats(rawData), error: null }
    })
  },

  async listAffiliateOverview(): Promise<QueryResult<AffiliateOverview[]>> {
    'use cache'

    return runQuery(async () => {
      const result = await db.execute(
        sql`SELECT * FROM get_affiliate_overview()`,
      )

      if (!result || result.length === 0) {
        return { data: [], error: null }
      }

      return { data: convertAffiliateOverview(result), error: null }
    })
  },

  async getAffiliateProfiles(userIds: string[]): Promise<QueryResult<AffiliateProfile[]>> {
    'use cache'

    return runQuery(async () => {
      if (!userIds.length) {
        return { data: [], error: null }
      }

      const result = await db
        .select({
          id: users.id,
          username: users.username,
          address: users.address,
          proxy_wallet_address: users.proxy_wallet_address,
          image: users.image,
          affiliate_code: users.affiliate_code,
        })
        .from(users)
        .where(inArray(users.id, userIds))

      const data = result.map(user => ({
        id: user.id,
        username: user.username!,
        address: user.address,
        proxy_wallet_address: user.proxy_wallet_address,
        image: user.image,
        affiliate_code: user.affiliate_code,
      }))

      return { data, error: null }
    })
  },

  async listReferralsByAffiliate(affiliateUserId: string, limit = 20): Promise<QueryResult<ReferralList[]>> {
    'use cache'

    return runQuery(async () => {
      const result = await db
        .select({
          user_id: affiliate_referrals.user_id,
          created_at: affiliate_referrals.created_at,
          username: users.username,
          address: users.address,
          proxy_wallet_address: users.proxy_wallet_address,
          image: users.image,
        })
        .from(affiliate_referrals)
        .innerJoin(users, eq(affiliate_referrals.user_id, users.id))
        .where(eq(affiliate_referrals.affiliate_user_id, affiliateUserId))
        .orderBy(desc(affiliate_referrals.created_at))
        .limit(limit)

      const data = result.map(row => ({
        user_id: row.user_id,
        created_at: row.created_at,
        users: {
          username: row.username!,
          address: row.address,
          proxy_wallet_address: row.proxy_wallet_address,
          image: row.image,
        },
      }))

      return { data, error: null }
    })
  },
}
