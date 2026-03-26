import type { AllowedMarketCreatorRecord, AllowedMarketCreatorSourceType } from '@/lib/allowed-market-creators'
import type { QueryResult } from '@/types'
import { and, asc, eq, notInArray, sql } from 'drizzle-orm'
import { getAddress } from 'viem'
import { allowed_market_creators } from '@/lib/db/schema'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

interface UpsertAllowedMarketCreatorInput {
  walletAddress: string
  displayName: string
  sourceUrl?: string | null
  sourceType: AllowedMarketCreatorSourceType
}

function normalizeWalletAddress(walletAddress: string) {
  return getAddress(walletAddress).toLowerCase()
}

function mapAllowedMarketCreatorRow(row: typeof allowed_market_creators.$inferSelect): AllowedMarketCreatorRecord {
  return {
    walletAddress: row.wallet_address,
    displayName: row.display_name,
    sourceUrl: row.source_url,
    sourceType: row.source_type as AllowedMarketCreatorSourceType,
  }
}

export const AllowedMarketCreatorRepository = {
  async list(): Promise<QueryResult<AllowedMarketCreatorRecord[]>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(allowed_market_creators)
        .orderBy(
          asc(allowed_market_creators.display_name),
          asc(allowed_market_creators.wallet_address),
        )

      return {
        data: rows.map(mapAllowedMarketCreatorRow),
        error: null,
      }
    })
  },

  async listWallets(): Promise<QueryResult<string[]>> {
    return runQuery(async () => {
      const rows = await db
        .select({ walletAddress: allowed_market_creators.wallet_address })
        .from(allowed_market_creators)
        .orderBy(asc(allowed_market_creators.wallet_address))

      return {
        data: rows.map(row => row.walletAddress),
        error: null,
      }
    })
  },

  async upsertMany(entries: UpsertAllowedMarketCreatorInput[]): Promise<QueryResult<AllowedMarketCreatorRecord[]>> {
    return runQuery(async () => {
      if (entries.length === 0) {
        return { data: [], error: null }
      }

      const dedupedEntries = new Map<string, typeof allowed_market_creators.$inferInsert>()
      for (const entry of entries) {
        const normalizedWalletAddress = normalizeWalletAddress(entry.walletAddress)
        dedupedEntries.set(normalizedWalletAddress, {
          wallet_address: normalizedWalletAddress,
          display_name: entry.displayName.trim(),
          source_url: entry.sourceType === 'site' ? (entry.sourceUrl?.trim() ?? null) : null,
          source_type: entry.sourceType,
        })
      }

      const rows = await db
        .insert(allowed_market_creators)
        .values([...dedupedEntries.values()])
        .onConflictDoUpdate({
          target: allowed_market_creators.wallet_address,
          set: {
            display_name: sql`EXCLUDED.display_name`,
            source_url: sql`EXCLUDED.source_url`,
            source_type: sql`EXCLUDED.source_type`,
          },
        })
        .returning()

      return {
        data: rows.map(mapAllowedMarketCreatorRow),
        error: null,
      }
    })
  },

  async replaceSiteSource(input: {
    sourceUrl: string
    displayName: string
    walletAddresses: string[]
  }): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      const normalizedWalletAddresses = [...new Set(
        input.walletAddresses.map(walletAddress => normalizeWalletAddress(walletAddress)),
      )]
      const normalizedSourceUrl = input.sourceUrl.trim()
      const normalizedDisplayName = input.displayName.trim()

      await db.transaction(async (tx) => {
        if (normalizedWalletAddresses.length > 0) {
          await tx
            .delete(allowed_market_creators)
            .where(and(
              eq(allowed_market_creators.source_type, 'site'),
              eq(allowed_market_creators.source_url, normalizedSourceUrl),
              notInArray(allowed_market_creators.wallet_address, normalizedWalletAddresses),
            ))

          await tx
            .insert(allowed_market_creators)
            .values(normalizedWalletAddresses.map(walletAddress => ({
              wallet_address: walletAddress,
              display_name: normalizedDisplayName,
              source_url: normalizedSourceUrl,
              source_type: 'site' as const,
            })))
            .onConflictDoUpdate({
              target: allowed_market_creators.wallet_address,
              set: {
                display_name: sql`EXCLUDED.display_name`,
                source_url: sql`EXCLUDED.source_url`,
                source_type: sql`EXCLUDED.source_type`,
              },
            })
        }
      })

      return {
        data: true,
        error: null,
      }
    })
  },

  async deleteByWallet(walletAddress: string): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      const normalizedWalletAddress = normalizeWalletAddress(walletAddress)
      const deletedRows = await db
        .delete(allowed_market_creators)
        .where(eq(allowed_market_creators.wallet_address, normalizedWalletAddress))
        .returning({ walletAddress: allowed_market_creators.wallet_address })

      return {
        data: deletedRows.length > 0,
        error: null,
      }
    })
  },

  async deleteBySourceUrl(sourceUrl: string): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      const deletedRows = await db
        .delete(allowed_market_creators)
        .where(and(
          eq(allowed_market_creators.source_type, 'site'),
          eq(allowed_market_creators.source_url, sourceUrl.trim()),
        ))
        .returning({ walletAddress: allowed_market_creators.wallet_address })

      return {
        data: deletedRows.length > 0,
        error: null,
      }
    })
  },
}
